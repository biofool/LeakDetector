#!/usr/bin/env python3
"""Scan a git working tree for accidentally committed secrets.

Detects live credential values (API keys, tokens, private keys) in git-tracked
and staged files — including secrets pasted into .env.example / .env.template
by mistake. Patterns: see AGENTS.md "Secret-pattern reference". Placeholders
(your-key-here, changeme, xxx, placeholder, empty) are skipped. Writes an
audit JSON to data/audit/secret_scan_<ts>.json unless --dry-run.

Usage: python3 scripts/scan_secrets.py [--dry-run] [--staged-only]
       [--limit N] [--offset N] [--audit-dir DIR] [--repo-root DIR]
Exit: 0 clean · 1 secrets found · 2 scanner error (git unavailable, etc.).
"""

from __future__ import annotations

# Canonical source: biofool/starter scripts/scan_secrets.py.
# Copies in consumer repos are vendored — diff against this version stamp
# (or run starter/scripts/check-drift.sh) instead of editing in place.
__version__ = "2026.11.12"

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

# (name, compiled_regex, min_match_length); min_len filters short false hits.
SECRET_PATTERNS: list[tuple[str, re.Pattern, int]] = [
    ("openrouter_api_key", re.compile(r"sk-or-v1-[0-9A-Za-z]{20,}"), 30),
    ("google_api_key", re.compile(r"AIza[0-9A-Za-z_-]{35}"), 39),
    ("gitlab_pat", re.compile(r"glpat-[0-9A-Za-z_-]{20}"), 26),
    ("openai_api_key", re.compile(r"sk-[0-9A-Za-z]{48}"), 51),
    ("anthropic_api_key", re.compile(r"sk-ant-[0-9A-Za-z_-]{40,}"), 48),
    ("github_pat", re.compile(r"ghp_[0-9A-Za-z]{36}"), 40),
    ("github_oauth", re.compile(r"gho_[0-9A-Za-z]{36}"), 40),
    ("slack_token", re.compile(r"xox[baprs]-[0-9A-Za-z-]{10,}"), 20),
    ("aws_access_key_id", re.compile(r"AKIA[0-9A-Z]{16}"), 20),
    ("pem_private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), 25),
]

# Placeholder values that are NOT live secrets — skip matches containing these.
PLACEHOLDER_RE = re.compile(
    r"(your[-_]?key[-_]?here|changeme|placeholder|xxx+|example|"
    r"replace[-_]?me|insert[-_]?key|<.+>|\.\.\.|fake|test[-_]?key|"
    r"dummy|sample|redacted|stale|supersecret|dead[-_]?key|"
    r"old[-_]?key|expired|revoked)",
    re.IGNORECASE,
)

# Binary/lock/pointer suffixes skipped. .toml/.ipynb ARE scanned — pyproject
# can hold PyPI tokens, notebooks can carry pasted keys in cells (issue #3).
SKIP_SUFFIXES = {
    ".pyc", ".pyo", ".so", ".o", ".a", ".dylib", ".dll", ".exe",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flv", ".webm",
    ".lock", ".dvc", ".dvcignore",
}

# Directories to never scan (audit JSON may contain redacted refs).
SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", "__pycache__", ".mypy_cache",
    ".ruff_cache", ".pytest_cache", ".tox", "dist", "build", ".eggs",
    ".dvc/cache", ".dvc/tmp", "data/audit",
}


def run_git(args: list[str], repo_root: Path) -> str:
    """Run a git command and return stdout. Raises on error."""
    result = subprocess.run(
        ["git"] + args, cwd=repo_root, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def list_files(repo_root: Path, staged: bool) -> list[str]:
    """Git-tracked files, or only staged (ACM) files when staged=True."""
    args = (["diff", "--cached", "--name-only", "--diff-filter=ACM"]
            if staged else ["ls-files"])
    return [f for f in run_git(args, repo_root).splitlines() if f.strip()]


def should_skip_file(filepath: str) -> bool:  # by suffix or containing dir
    return (not filepath
            or any(d in filepath.split("/") for d in SKIP_DIRS)
            or Path(filepath).suffix.lower() in SKIP_SUFFIXES)


def get_staged_content(repo_root: Path, filepath: str) -> str | None:
    """STAGED blob content, or None — the index is the commit's truth (#3)."""
    r = subprocess.run(["git", "show", f":{filepath}"],
                       cwd=repo_root, capture_output=True, timeout=30)
    return None if r.returncode != 0 else r.stdout.decode("utf-8", errors="replace")


def scan_content(content: str, filepath: Path) -> list[dict]:
    """Scan one file's text for secret patterns. Returns list of findings."""
    findings = []
    lines_list = content.splitlines()
    for line_num, line in enumerate(lines_list, 1):
        for name, pattern, min_len in SECRET_PATTERNS:
            for match in pattern.finditer(line):
                match_text = match.group()
                # Placeholder check on the MATCHED value only — a "# test key"
                # comment must not suppress a real secret (issue #3).
                if len(match_text) < min_len or PLACEHOLDER_RE.search(match_text):
                    continue
                if "=" in line:
                    value_part = line.split("=", 1)[1].strip()
                    if PLACEHOLDER_RE.search(value_part) and len(value_part) < 40:
                        continue
                if name == "pem_private_key" and _pem_is_illustration(
                        lines_list, line_num, line, filepath):
                    continue
                findings.append({
                    "pattern_name": name,
                    "line_number": line_num,
                    # sha256 fingerprint only — even a prefix aids brute-force
                    # in a committed/shared audit JSON (biofool/starter#11).
                    "match_fingerprint": hashlib.sha256(
                        match_text.encode()).hexdigest()[:8],
                    "match_length": len(match_text),
                    "line_redacted": _redact_line(line),
                })
    return findings


def _pem_is_illustration(lines_list: list[str], line_num: int, line: str,
                         filepath: Path) -> bool:
    """True when a BEGIN-PRIVATE-KEY match is doc/example boilerplate, not a
    real key. A PEM pasted into docs must NOT be blanket-skipped (issue #3) —
    flag it when real key material follows (END marker or base64 block)."""
    context = " ".join(lines_list[max(0, line_num - 2):line_num + 2])
    if PLACEHOLDER_RE.search(line) or PLACEHOLDER_RE.search(context):
        return True
    if not (filepath.suffix.lower() in (".md", ".example", ".template")
            or str(filepath).endswith(".tfvars.example")):
        return False
    window = lines_list[line_num - 1:line_num + 10]
    return not any(re.search(
        r"-----END [A-Z ]*PRIVATE KEY-----|^[A-Za-z0-9+/=]{40,}$", w)
        for w in window)


def _redact_line(line: str) -> str:
    """Mask EVERY known pattern — a sibling credential on the same line must
    not leak into CI logs/audit JSON (issue #3)."""
    for _name, pattern, _min_len in SECRET_PATTERNS:
        line = pattern.sub("REDACTED", line)
    return line.rstrip()


def scan_repo(repo_root: Path, files: list[str], limit: int | None = None,
              offset: int = 0, staged: bool = False) -> dict:
    """Scan files, return an audit report dict. With staged=True the STAGED
    blob (git show :file) is scanned — the index is the commit's truth."""
    all_findings, files_scanned, files_skipped = [], 0, 0
    for filepath_str in files[offset:]:
        if limit is not None and files_scanned >= limit:
            break
        if should_skip_file(filepath_str):
            files_skipped += 1
            continue
        filepath = repo_root / filepath_str
        if staged:
            content = get_staged_content(repo_root, filepath_str)
        else:
            try:
                content = (filepath.read_text(encoding="utf-8", errors="replace")
                           if filepath.is_file() else None)
            except (OSError, UnicodeDecodeError) as exc:
                print(f"  [skip] {filepath}: {exc}", file=sys.stderr)
                content = None
        if content is None:
            files_skipped += 1
            continue
        files_scanned += 1
        findings = scan_content(content, filepath)
        if findings:
            all_findings.append({"file": filepath_str, "findings": findings})
    return {
        "scan_timestamp": datetime.now(UTC).isoformat(),
        "repo_root": str(repo_root),
        "files_scanned": files_scanned,
        "files_skipped": files_skipped,
        "secrets_found": sum(len(f["findings"]) for f in all_findings),
        "files_with_secrets": len(all_findings),
        "findings": all_findings,
    }


def main() -> int:
    p = argparse.ArgumentParser(
        description="Scan git working tree for accidentally committed secrets.")
    p.add_argument("--dry-run", action="store_true", help="report only; no audit JSON")
    p.add_argument("--staged-only", action="store_true", help="scan staged blobs")
    p.add_argument("--limit", type=int, default=None, help="max files to scan")
    p.add_argument("--offset", type=int, default=0, help="skip first N files")
    p.add_argument("--audit-dir", default="data/audit", help="audit JSON dir")
    p.add_argument("--repo-root", default=None, help="default: git toplevel")
    args = p.parse_args()

    try:
        repo_root = (Path(args.repo_root).resolve() if args.repo_root else
                     Path(run_git(["rev-parse", "--show-toplevel"], Path.cwd()).strip()))
    except (RuntimeError, FileNotFoundError) as exc:
        print(f"ERROR: could not determine git repo root: {exc}", file=sys.stderr)
        return 2

    print(f"Scanning {repo_root}")
    try:
        files = list_files(repo_root, args.staged_only)
        print(f"Mode: {'staged-only' if args.staged_only else 'tracked files'} ({len(files)} {'staged files' if args.staged_only else 'tracked files'})")
    except RuntimeError as exc:
        print(f"ERROR: could not list files: {exc}", file=sys.stderr)
        return 2

    report = scan_repo(repo_root, files, limit=args.limit,
                       offset=args.offset, staged=args.staged_only)
    print(f"Files scanned: {report['files_scanned']}\n"
          f"Files skipped: {report['files_skipped']}\n"
          f"Secrets found: {report['secrets_found']}")

    if report["findings"]:
        print("\n=== FINDINGS ===")
        for ff in report["findings"]:
            print(f"\n{ff['file']}:")
            for f in ff["findings"]:
                print(f"  line {f['line_number']}: [{f['pattern_name']}] "
                      f"sha256:{f['match_fingerprint']} (len={f['match_length']})")
                print(f"    > {f['line_redacted']}")

    if not args.dry_run and report["findings"]:
        audit_dir = repo_root / args.audit_dir
        audit_dir.mkdir(parents=True, exist_ok=True)
        audit_path = audit_dir / f"secret_scan_{datetime.now(UTC):%Y%m%dT%H%M%SZ}.json"
        audit_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"\nAudit report written to: {audit_path}")

    return 1 if report["secrets_found"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
