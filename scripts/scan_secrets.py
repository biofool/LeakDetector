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

import argparse
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
    ".lock", ".toml",  # lock/toml files are deps manifests, not source
    ".dvc", ".dvcignore",  # DVC pointer files (hashes, not secrets)
    ".ipynb",  # notebooks — scan separately if needed
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


def scan_file(filepath: Path) -> list[dict]:
    """Scan a single file for secret patterns. Returns list of findings."""
    findings = []
    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except (OSError, UnicodeDecodeError) as exc:
        # Log but don't fail — binary/unreadable files are skipped
        print(f"  [skip] {filepath}: {exc}", file=sys.stderr)
        return findings

    for line_num, line in enumerate(content.splitlines(), 1):
        for name, pattern, min_len in SECRET_PATTERNS:
            for match in pattern.finditer(line):
                match_text = match.group()
                if len(match_text) < min_len:
                    continue
                # Skip placeholders
                if PLACEHOLDER_RE.search(match_text):
                    continue
                # Skip if the full line contains placeholder context markers
                # (e.g. STALE_KEY=..., fake_key=..., test_key=...)
                if PLACEHOLDER_RE.search(line):
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
                    # Skip PEM in documentation/template files
                    if filepath.suffix.lower() in (".md", ".example", ".template"):
                        continue
                    if str(filepath).endswith((".example", ".tfvars.example")):
                        continue

                findings.append({
                    "pattern_name": name,
                    "line_number": line_num,
                    "match_prefix": match_text[:8] + "..." + match_text[-4:],
                    "match_length": len(match_text),
                    "line_redacted": _redact_line(line, match_text),
                })
    return findings


def _redact_line(line: str, secret: str) -> str:
    """Replace the secret value in the line with REDACTED, keeping key name."""
    return line.replace(secret, "REDACTED").rstrip()


def scan_repo(
    repo_root: Path,
    files: list[str],
    limit: int | None = None,
    offset: int = 0,
) -> dict:
    """Scan a list of files and return an audit report dict."""
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
        if not filepath.is_file():
            files_skipped += 1
            continue
        files_scanned += 1
        findings = scan_file(filepath)
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
        help="Scan only staged files (for pre-commit hook use).",
    )
    parser.add_argument(
        "--tracked-only", action="store_true",
        help="Scan only git-tracked files (skip staged-only check).",
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
    report = scan_repo(repo_root, files, limit=args.limit, offset=args.offset)

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
                    f"{f['match_prefix']} (len={f['match_length']})"
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
