from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _send_email(to: str, subject: str, html_body: str) -> None:
    if not settings.smtp_configured:
        logger.warning(
            "SMTP not configured — email to %s skipped (subject: %s). "
            "Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env to enable.",
            to,
            subject,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=settings.SMTP_USE_TLS,
    )
    logger.info("Email sent to %s (subject: %s)", to, subject)


def _base_html(title: str, body_content: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#131318;border-radius:16px;border:1px solid #1e1e2e;padding:40px;">
        <tr><td style="text-align:center;padding-bottom:24px;">
          <span style="font-size:24px;font-weight:bold;color:#fff;">LaunchPad<span style="color:#7c3aed;">AI</span></span>
        </td></tr>
        <tr><td>{body_content}</td></tr>
        <tr><td style="padding-top:32px;text-align:center;">
          <p style="color:#71717a;font-size:12px;margin:0;">
            This email was sent by LaunchPadAI. If you did not request this, you can safely ignore it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_verification_email(to: str, name: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    body = f"""\
<h2 style="color:#fff;margin:0 0 8px;">Verify your email</h2>
<p style="color:#a1a1aa;font-size:15px;line-height:1.6;">
  Hi {name}, welcome to LaunchPadAI! Please verify your email address to get started.
</p>
<div style="text-align:center;padding:24px 0;">
  <a href="{verify_url}"
     style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
            color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
    Verify Email Address
  </a>
</div>
<p style="color:#71717a;font-size:13px;">
  Or copy this link into your browser:<br/>
  <a href="{verify_url}" style="color:#7c3aed;word-break:break-all;">{verify_url}</a>
</p>
<p style="color:#71717a;font-size:13px;">
  This link expires in {settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hours.
</p>"""
    await _send_email(to, "Verify your email — LaunchPadAI", _base_html("Verify Email", body))


async def send_password_reset_email(to: str, name: str, token: str) -> None:
    reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={token}"
    body = f"""\
<h2 style="color:#fff;margin:0 0 8px;">Reset your password</h2>
<p style="color:#a1a1aa;font-size:15px;line-height:1.6;">
  Hi {name}, we received a request to reset the password for your LaunchPadAI account.
</p>
<div style="text-align:center;padding:24px 0;">
  <a href="{reset_url}"
     style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#6d28d9);
            color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
    Reset Password
  </a>
</div>
<p style="color:#71717a;font-size:13px;">
  Or copy this link into your browser:<br/>
  <a href="{reset_url}" style="color:#7c3aed;word-break:break-all;">{reset_url}</a>
</p>
<p style="color:#71717a;font-size:13px;">
  This link expires in {settings.PASSWORD_RESET_EXPIRE_HOURS} hour(s). If you didn't request a password reset,
  no action is needed.
</p>"""
    await _send_email(to, "Reset your password — LaunchPadAI", _base_html("Reset Password", body))
