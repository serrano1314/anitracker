import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.SMTP_HOST and settings.SMTP_FROM and settings.CONTACT_INBOX_EMAIL)


def send_admin_email(subject: str, plain_body: str, reply_to: str | None = None) -> None:
    settings = get_settings()
    inbox = settings.CONTACT_INBOX_EMAIL.strip()
    if not inbox:
        logger.error("CONTACT_INBOX_EMAIL is not configured")
        raise RuntimeError("Contact inbox is not configured")

    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        logger.info("SMTP not configured; contact message logged only:\n%s", plain_body)
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = inbox
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(plain_body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as client:
        if settings.SMTP_USE_TLS:
            client.starttls()
        if settings.SMTP_USER:
            client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        client.send_message(message)
