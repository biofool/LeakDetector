"""Duty-officer email notifications.

Configured entirely by env vars. When SMTP is not configured the module
logs a WARNING on first use per process and still records an audit line in
data/audit/notifications.log — it never fails silently and never raises
into the request path.
"""
import json
import logging
import os
import smtplib
import time
from email.message import EmailMessage
from pathlib import Path

log = logging.getLogger(__name__)

AUDIT_LOG = Path(os.environ.get("LEAK_AUDIT_DIR", "data/audit")) / "notifications.log"

_warned = False


def _smtp_config() -> dict | None:
    global _warned
    host = os.environ.get("SMTP_HOST")
    to = os.environ.get("DUTY_EMAIL")
    if not host or not to:
        if not _warned:
            log.warning(
                "SMTP not configured (SMTP_HOST/DUTY_EMAIL unset); "
                "notifications will be logged to %s only", AUDIT_LOG
            )
            _warned = True
        return None
    return {
        "host": host,
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER"),
        "password": os.environ.get("SMTP_PASS"),
        "from": os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "leakdetector@localhost")),
        "to": to,
    }


def notify_new_report(report: dict, base_url: str = "") -> None:
    """Email the duty officer about a new leak report; always audit-logs."""
    subject = f"[LeakDetector] New {report['category']} leak — {report['id'][:8]}"
    lines = [
        f"Category: {report['category']}",
        f"Size: {report.get('size', 'unknown')}",
        f"Location: {report['lat']:.5f}, {report['lon']:.5f}",
        f"Zone: {report.get('council_zone') or 'unassigned'}",
        f"Map: https://www.openstreetmap.org/?mlat={report['lat']}&mlon={report['lon']}#map=18/{report['lat']}/{report['lon']}",
        f"SLA due: {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(report['sla_due_at'])) if report.get('sla_due_at') else 'n/a'}",
    ]
    if report.get("description"):
        lines.append(f"Description: {report['description']}")
    if base_url:
        lines.append(f"Report: {base_url}/map.html?focus={report['id']}")
    _deliver(subject, "\n".join(lines), context={"report_id": report["id"], "kind": "new_report"})


def notify_status_change(report: dict, to_addr: str | None = None) -> None:
    subject = f"[LeakDetector] Report {report['id'][:8]} is now {report['status']}"
    body = f"Status: {report['status']}\nLocation: {report['lat']:.5f}, {report['lon']:.5f}"
    _deliver(subject, body, to_addr=to_addr, context={"report_id": report["id"], "kind": "status_change"})


def _deliver(subject: str, body: str, to_addr: str | None = None, context: dict | None = None) -> None:
    cfg = _smtp_config()
    AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": int(time.time()),
        "subject": subject,
        "delivered": False,
        **(context or {}),
    }
    if cfg:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = cfg["from"]
        msg["To"] = to_addr or cfg["to"]
        msg.set_content(body)
        try:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as s:
                s.starttls()
                if cfg["user"]:
                    s.login(cfg["user"], cfg["password"] or "")
                s.send_message(msg)
            record["delivered"] = True
        except (OSError, smtplib.SMTPException) as e:
            log.error("Failed to send notification '%s': %s", subject, e)
            record["error"] = str(e)
    with AUDIT_LOG.open("a") as f:
        f.write(json.dumps(record) + "\n")
