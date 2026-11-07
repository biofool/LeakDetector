#!/usr/bin/env python3
"""Scan a git working tree for accidentally committed secrets.

Detects live credential values (API keys, tokens, private keys) in git-tracked
and staged files. Flags secrets that slipped past .gitignore or were pasted
into .env.example / .env.template by mistake. Writes an audit JSON report to
data/audit/secret_scan_<timestamp>.json per the one-off fix script convention.

Patterns detected (see AGENTS.md "Secret-pattern reference"):
  sk-or-v1-         OpenRouter API key
  AIza[0-9A-Za-z_-]{35}   Google API key (Maps, Gemini, etc.)
  glpat-[0-9A-Za-z_-]{20} GitLab personal access token
  sk-[0-9A-Za-z]{48}      OpenAI API key (sk-ant- for Anthropic)
  ghp_[0-9A-Za-z]{36}     GitHub personal access token
  gho_[0-9A-Za-z]{36}     GitHub OAuth token
  xox[baprs]-[0-9A-Za-z-]+  Slack token
  AKIA[0-9A-Z]{16}        AWS access key ID
  -----BEGIN .* PRIVATE KEY-----  PEM private key block

Placeholder values (your-key-here, changeme, xxx, placeholder, empty) are
skipped — they are not live secrets.

Usage:
  python3 scripts/scan_secrets.py                    # scan tracked + staged files
  python3 scripts/scan_secrets.py --dry-run          # report only, no audit file write
  python3 scripts/scan_secrets.py --staged-only      # scan only staged files (for pre-commit)
  python3 scripts/scan_secrets.py --limit 50         # limit files scanned (testing)
  python3 scripts/scan_secrets.py --offset 10        # skip first N files (testing)

Exit codes:
  0 — no secrets found
  1 — one or more secrets found (audit JSON written unless --dry-run)
  2 — scanner error (could not run git, etc.)
"""

from __future__ import annotations

# Canonical source: biofool/starter scripts/scan_secrets.py.
# Copies in consumer repos are vendored — diff against this version stamp
# (or run starter/scripts/check-drift.sh) instead of editing in place.
__version__ = "2026.11.07"

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

# ─── Secret patterns ──────────────────────────────────────────────────────
# Each entry: (name, compiled_regex, min_match_length)
# min_match_length filters out trivially short false positives.

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
# Also checks the surrounding line for context markers (e.g. STALE_KEY=, fake, etc.)
PLACEHOLDER_RE = re.compile(
    r"(your[-_]?key[-_]?here|changeme|placeholder|xxx+|example|"
    r"replace[-_]?me|insert[-_]?key|<.+>|\.\.\.|fake|test[-_]?key|"
    r"dummy|sample|redacted|stale|supersecret|dead[-_]?key|"
    r"old[-_]?key|expired|revoked)",
    re.IGNORECASE,
)

# Files that are known-safe to skip (binary, lock files, etc.)
SKIP_SUFFIXES = {
    ".pyc", ".pyo", ".so", ".o", ".a", ".dylib", ".dll", ".exe",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".mp3", ".mp4", ".avi", ".mov", ".wav", ".flv", ".webm",
    ".lock",
    ".dvc", ".dvcignore",  # DVC pointer files (hashes, not secrets)
    # NOTE: .toml and .ipynb are SCANNED — pyproject.toml can hold PyPI
    # tokens and notebooks can carry pasted keys in cells (issue #3).
}

# Directories to never scan
SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", "__pycache__", ".mypy_cache",
    ".ruff_cache", ".pytest_cache", ".tox", "dist", "build", ".eggs",
    ".dvc/cache", ".dvc/tmp", "data/audit",  # audit JSON may contain redacted refs
}


def run_git(args: list[str], repo_root: Path) -> str:
    """Run a git command and return stdout. Raises on error."""
    result = subprocess.run(
        ["git"] + args,
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def get_tracked_files(repo_root: Path) -> list[str]:
    """List all git-tracked files (committed or staged)."""
    out = run_git(["ls-files"], repo_root)
    return [f for f in out.splitlines() if f.strip()]


def get_staged_files(repo_root: Path) -> list[str]:
    """List only staged (added/copied/modified) files."""
    out = run_git(["diff", "--cached", "--name-only", "--diff-filter=ACM"], repo_root)
    return [f for f in out.splitlines() if f.strip()]


def should_skip_file(filepath: str) -> bool:
    """Check if a file should be skipped based on suffix or directory."""
    if not filepath:
        return True
    parts = filepath.split("/")
    for skip_dir in SKIP_DIRS:
        if skip_dir in parts:
            return True
    suffix = Path(filepath).suffix.lower()
    if suffix in SKIP_SUFFIXES:
        return True
    return False


def get_staged_content(repo_root: Path, filepath: str) -> str | None:
    """Return the STAGED blob content for filepath, or None.

    Scanning the working tree lets a commit slip a secret through when the
    file was staged then edited again (issue #3) — the index is the source
    of truth for what the commit will contain.
    """
    result = subprocess.run(
        ["git", "show", f":{filepath}"],
        cwd=repo_root, capture_output=True, timeout=30,
    )
    if result.returncode != 0:
        return None
    return result.stdout.decode("utf-8", errors="replace")


def scan_content(content: str, filepath: Path) -> list[dict]:
    """Scan one file's text for secret patterns. Returns list of findings."""
    findings = []
    for line_num, line in enumerate(content.splitlines(), 1):
        for name, pattern, min_len in SECRET_PATTERNS:
            for match in pattern.finditer(line):
                match_text = match.group()
                if len(match_text) < min_len:
                    continue
                # Skip placeholders — check the MATCHED value only, never
                # the whole line: a comment like "# test key" on the same
                # line must not suppress a real secret (issue #3).
                if PLACEHOLDER_RE.search(match_text):
                    continue
                # Skip if the whole value after = looks like a placeholder
                # (e.g. KEY=your-key-here might still match a prefix pattern)
                if "=" in line:
                    value_part = line.split("=", 1)[1].strip()
                    if PLACEHOLDER_RE.search(value_part) and len(value_part) < 40:
                        continue
                # Skip PEM blocks in documentation/example context — check the
                # full line for placeholder markers (... <auto-fetched> etc.)
                if name == "pem_private_key":
                    if PLACEHOLDER_RE.search(line):
                        continue
                    # Check surrounding lines for placeholder context (the
                    # <auto-fetched> marker may be on the next line)
                    lines_list = content.splitlines()
                    context = " ".join(
                        lines_list[max(0, line_num - 2):line_num + 2]
                    )
                    if PLACEHOLDER_RE.search(context):
                        continue
                    # Doc/template files: a lone BEGIN header is usually an
                    # illustration — flag only when real key material follows
                    # (END marker or a base64 block). A real PEM pasted into
                    # docs must NOT be blanket-skipped (issue #3).
                    if (filepath.suffix.lower() in (".md", ".example", ".template")
                            or str(filepath).endswith((".example", ".tfvars.example"))):
                        window = lines_list[line_num - 1:line_num + 10]
                        has_material = any(
                            re.search(r"-----END [A-Z ]*PRIVATE KEY-----|^[A-Za-z0-9+/=]{40,}$", w)
                            for w in window
                        )
                        if not has_material:
                            continue

                findings.append({
                    "pattern_name": name,
                    "line_number": line_num,
                    # No raw characters of the match — audit JSONs get
                    # committed/shared, and even a prefix narrows a
                    # brute-force search (biofool/starter#11). A truncated
                    # sha256 is enough to dedupe repeat findings.
                    "match_fingerprint": hashlib.sha256(
                        match_text.encode()
                    ).hexdigest()[:8],
                    "match_length": len(match_text),
                    "line_redacted": _redact_line(line),
                })
    return findings


def _redact_line(line: str) -> str:
    """Mask EVERY known secret pattern in the line, not just the matched one —
    a sibling credential on the same line must not leak into CI logs or the
    uploaded audit JSON (issue #3)."""
    redacted = line
    for _name, pattern, _min_len in SECRET_PATTERNS:
        redacted = pattern.sub("REDACTED", redacted)
    return redacted.rstrip()


def scan_repo(
    repo_root: Path,
    files: list[str],
    limit: int | None = None,
    offset: int = 0,
    staged: bool = False,
) -> dict:
    """Scan a list of files and return an audit report dict.

    When ``staged`` is true the STAGED blob (git show :file) is scanned —
    the index, not the working tree, is what the commit will contain.
    """
    all_findings = []
    files_scanned = 0
    files_skipped = 0

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
            if not filepath.is_file():
                files_skipped += 1
                continue
            try:
                content = filepath.read_text(encoding="utf-8", errors="replace")
            except (OSError, UnicodeDecodeError) as exc:
                # Log but don't fail — binary/unreadable files are skipped
                print(f"  [skip] {filepath}: {exc}", file=sys.stderr)
                files_skipped += 1
                continue
        if content is None:
            files_skipped += 1
            continue
        files_scanned += 1
        findings = scan_content(content, filepath)
        if findings:
            all_findings.append({
                "file": filepath_str,
                "findings": findings,
            })

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
    parser = argparse.ArgumentParser(
        description="Scan git working tree for accidentally committed secrets."
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Report findings only; do not write audit JSON file.",
    )
    parser.add_argument(
        "--staged-only", action="store_true",
        help="Scan only staged files, reading the staged blobs (for pre-commit hook use).",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Maximum number of files to scan (for testing).",
    )
    parser.add_argument(
        "--offset", type=int, default=0,
        help="Skip the first N files (for testing).",
    )
    parser.add_argument(
        "--audit-dir", default="data/audit",
        help="Directory for audit JSON output (default: data/audit).",
    )
    parser.add_argument(
        "--repo-root", default=None,
        help="Repository root (default: auto-detect via git rev-parse).",
    )
    args = parser.parse_args()

    # Determine repo root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        try:
            out = run_git(["rev-parse", "--show-toplevel"], Path.cwd())
            repo_root = Path(out.strip())
        except (RuntimeError, FileNotFoundError) as exc:
            print(f"ERROR: could not determine git repo root: {exc}", file=sys.stderr)
            return 2

    print(f"Scanning {repo_root}")

    # Get file list
    try:
        if args.staged_only:
            files = get_staged_files(repo_root)
            print(f"Mode: staged-only ({len(files)} staged files)")
        else:
            files = get_tracked_files(repo_root)
            print(f"Mode: tracked files ({len(files)} tracked files)")
    except RuntimeError as exc:
        print(f"ERROR: could not list files: {exc}", file=sys.stderr)
        return 2

    # Scan
    report = scan_repo(repo_root, files, limit=args.limit, offset=args.offset,
                       staged=args.staged_only)

    # Print summary
    print(f"Files scanned: {report['files_scanned']}")
    print(f"Files skipped: {report['files_skipped']}")
    print(f"Secrets found: {report['secrets_found']}")

    if report["findings"]:
        print("\n=== FINDINGS ===")
        for file_finding in report["findings"]:
            print(f"\n{file_finding['file']}:")
            for f in file_finding["findings"]:
                print(
                    f"  line {f['line_number']}: [{f['pattern_name']}] "
                    f"sha256:{f['match_fingerprint']} (len={f['match_length']})"
                )
                print(f"    > {f['line_redacted']}")

    # Write audit JSON (unless --dry-run)
    if not args.dry_run and report["findings"]:
        audit_dir = repo_root / args.audit_dir
        audit_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        audit_path = audit_dir / f"secret_scan_{timestamp}.json"
        audit_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"\nAudit report written to: {audit_path}")

    # Exit code: 1 if secrets found, 0 otherwise
    return 1 if report["secrets_found"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
