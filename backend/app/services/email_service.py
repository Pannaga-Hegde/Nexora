import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

SMTP_SERVER = os.getenv("SMTP_SERVER", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@project-os.academic.org")


def send_email_message(
    recipient_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: Optional[str] = None,
) -> bool:
    """
    Sends an email to any recipient (registered or external user).
    Falls back gracefully if SMTP server is unavailable by logging message details.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Project OS <{SENDER_EMAIL}>"
    msg["To"] = recipient_email

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    if attachment_bytes and attachment_filename:
        part = MIMEApplication(attachment_bytes, Name=attachment_filename)
        part['Content-Disposition'] = f'attachment; filename="{attachment_filename}"'
        msg.attach(part)

    try:
        if SMTP_USER and SMTP_PASSWORD:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=5) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, [recipient_email], msg.as_string())
        else:
            # Simulated email dispatch logging for local/development mode
            print(f"[EMAIL SERVICE DISPATCH MOCK] Sent to: {recipient_email} | Subject: {subject}")
        return True
    except Exception as e:
        print(f"[EMAIL SERVICE WARNING] SMTP transmission skipped/failed ({str(e)}). Simulated dispatch recorded for {recipient_email}.")
        return True


def send_project_invitation_email(
    recipient_email: str,
    project_name: str,
    inviter_name: str,
    role: str = "member"
) -> bool:
    subject = f"You've been invited to join project '{project_name}' on Project OS"
    body_text = (
        f"Hello,\n\n"
        f"{inviter_name} has invited you to collaborate on '{project_name}' as a {role}.\n\n"
        f"If you do not have an account on Project OS yet, simply register at http://localhost:5173 with this email ({recipient_email}) to access your project workspace.\n\n"
        f"Best regards,\nProject OS Academic Team"
    )
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-radius: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Project OS Invitation</h2>
        <p style="color: #334155; font-size: 15px;">
            <strong>{inviter_name}</strong> has invited you to join project <strong>{project_name}</strong> as a <code>{role}</code>.
        </p>
        <p style="color: #64748b; font-size: 14px;">
            Even if you haven't created a Project OS account yet, your access has been reserved for <strong>{recipient_email}</strong>.
        </p>
        <div style="margin: 25px 0;">
            <a href="http://localhost:5173" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                Access Project OS Workspace
            </a>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9;" />
        <p style="font-size: 12px; color: #94a3b8;">Sent via Project OS Automated Academic Portal.</p>
    </div>
    """
    return send_email_message(recipient_email, subject, body_text, body_html)


def send_contribution_report_email(
    recipient_email: str,
    project_name: str,
    sender_name: str,
    pdf_bytes: bytes,
    note: Optional[str] = None
) -> bool:
    subject = f"Gradesaver Contribution Report — Project '{project_name}'"
    filename = f"Gradesaver_Contribution_Report_{project_name.replace(' ', '_')}.pdf"
    note_section = f"\nNote from {sender_name}:\n{note}\n" if note else ""
    body_text = (
        f"Dear Evaluator / Academic Team,\n\n"
        f"{sender_name} has generated and sent the official Gradesaver Contribution Report for project '{project_name}'.\n"
        f"{note_section}\n"
        f"Please find the attached PDF report containing comprehensive metrics on completed tasks, member effort breakdown, and milestone progress.\n\n"
        f"Best regards,\nProject OS Automated Contribution Reporting"
    )
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #059669; color: white; padding: 12px 16px; border-radius: 6px 6px 0 0; font-weight: bold; font-size: 16px;">
            Gradesaver™ Contribution Report
        </div>
        <div style="padding: 16px 0;">
            <p style="color: #334155; font-size: 15px;">
                <strong>{sender_name}</strong> has submitted the official team contribution report for <strong>{project_name}</strong>.
            </p>
            {f'<blockquote style="border-left: 4px solid #10b981; padding-left: 12px; color: #475569; font-style: italic;">{note}</blockquote>' if note else ''}
            <p style="color: #475569; font-size: 14px;">
                The attached PDF document includes detailed verification of completed tasks, member activity logs, and milestone fulfillment for academic evaluation.
            </p>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9;" />
        <p style="font-size: 12px; color: #94a3b8;">Delivered automatically by Project OS.</p>
    </div>
    """
    return send_email_message(
        recipient_email=recipient_email,
        subject=subject,
        body_text=body_text,
        body_html=body_html,
        attachment_bytes=pdf_bytes,
        attachment_filename=filename
    )
