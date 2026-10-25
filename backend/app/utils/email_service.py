import logging
from typing import Optional
from azure.communication.email import EmailClient
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_email_client() -> Optional[EmailClient]:
    """
    Safely initialize and return an Azure EmailClient instance if connection string is configured.
    """
    connection_string = settings.AZURE_COMMUNICATION_CONNECTION_STRING
    if not connection_string or "endpoint=" not in connection_string:
        logger.warning(
            "AZURE_COMMUNICATION_CONNECTION_STRING is not configured or invalid. Emails will not be dispatched."
        )
        return None

    try:
        return EmailClient.from_connection_string(connection_string)
    except Exception as e:
        logger.error("Failed to initialize Azure EmailClient: %s", e)
        return None


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_text_content: Optional[str] = None,
) -> bool:
    """
    Generic Azure Communication Services email dispatcher with graceful error handling.
    Dispatches request to Azure asynchronously/non-blocking so web transactions are never stalled.
    Will never raise exceptions that disrupt database transactions or callers.
    """
    if not to_email:
        logger.warning("send_email called without a recipient email address.")
        return False

    client = get_email_client()
    if not client:
        logger.info(
            "Email to '%s' skipped (Azure EmailClient not initialized). Subject: '%s'",
            to_email,
            subject,
        )
        return False

    sender_address = settings.AZURE_EMAIL_SENDER
    if not sender_address:
        logger.warning("AZURE_EMAIL_SENDER is not configured.")
        return False

    plain_text = plain_text_content or "Please view this email in an HTML-compatible client."

    message = {
        "content": {
            "subject": subject,
            "plainText": plain_text,
            "html": html_content,
        },
        "recipients": {
            "to": [
                {"address": to_email}
            ]
        },
        "senderAddress": sender_address,
    }

    try:
        logger.info("Attempting to dispatch email to '%s' with subject '%s'", to_email, subject)
        poller = client.begin_send(message)
        logger.info(
            "Email successfully accepted by Azure Communication Services for '%s'. Operation status: %s",
            to_email,
            poller.status(),
        )
        return True
    except Exception as e:
        logger.error(
            "Failed to send email to '%s'. Error: %s",
            to_email,
            e,
            exc_info=True,
        )
        return False


def send_temporary_password_email(
    to_email: str,
    user_name: str,
    temp_password: str,
    role: str = "Employee",
) -> bool:
    """
    Send an onboarding email containing the temporary password and login instructions.
    """
    subject = f"Welcome to HCM Lite - Your Account Credentials ({role})"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }}
        .card {{ background-color: #ffffff; max-width: 580px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }}
        .header {{ border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }}
        .logo-title {{ font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin: 0; }}
        .logo-blue {{ color: #0066ff; }}
        .tagline {{ font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }}
        .badge {{ display: inline-block; padding: 4px 12px; background-color: #e0edff; color: #0066ff; font-size: 12px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; }}
        .content {{ line-height: 1.6; font-size: 15px; color: #334155; }}
        .credential-box {{ background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; margin: 24px 0; }}
        .highlight {{ font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 18px; font-weight: 700; color: #0066ff; letter-spacing: 1.5px; }}
        .btn {{ display: inline-block; background-color: #0066ff; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px; }}
        .warning {{ background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #b45309; margin-top: 20px; }}
        .footer {{ margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="badge">{role} Access Portal</div>
          <h1 class="logo-title">HCM<span class="logo-blue">Lite</span></h1>
          <div class="tagline">Smarter HR. Happier Teams.</div>
        </div>
        <div class="content">
          <p>Hello <strong>{user_name}</strong>,</p>
          <p>Your enterprise HCM Lite credentials have been provisioned by system administration. You now have authorized access to attendance, leave quotas, and employee records.</p>
          
          <div class="credential-box">
            <p style="margin: 0 0 10px 0;"><strong>Work Email:</strong> {to_email}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <span class="highlight">{temp_password}</span></p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="http://localhost:3000/login" class="btn">Log In to HCM Lite</a>
          </div>

          <div class="warning">
            <strong>Mandatory Security Protocol:</strong> You will be required to change this temporary password immediately upon your initial sign-in.
          </div>

          <p style="margin-top: 24px; font-size: 13px; color: #64748b;">If you did not anticipate receiving this email, please notify your organization's IT / HR security team immediately.</p>
        </div>
        <div class="footer">
          &copy; HCM Lite &bull; Smarter HR. Happier Teams. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Hello {user_name},\n\n"
        f"Your account in HCM Lite ({role}) has been created.\n\n"
        f"Email: {to_email}\n"
        f"Temporary Password: {temp_password}\n"
        f"Login URL: http://localhost:3000/login\n\n"
        f"Please log in and update your password immediately.\n\n"
        f"Best regards,\nHCM Administration"
    )
    return send_email(to_email, subject, html_content, plain_text)


def send_leave_notification_email(
    to_email: str,
    employee_name: str,
    leave_type: str,
    status: str,
    hr_comment: Optional[str] = None,
) -> bool:
    """
    Send leave request decision / status notification to the employee.
    """
    subject = f"Leave Request Update: {status.upper()} - {leave_type} Leave"
    status_color = "#16a34a" if status.lower() == "approved" else "#dc2626" if status.lower() == "rejected" else "#ca8a04"
    comment_html = f"<p><strong>HR Comment:</strong> {hr_comment}</p>" if hr_comment else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b; }}
        .card {{ background-color: #ffffff; max-width: 580px; margin: 0 auto; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; }}
        .status-badge {{ display: inline-block; padding: 6px 14px; background-color: {status_color}; color: #ffffff; font-size: 13px; font-weight: 700; border-radius: 6px; text-transform: uppercase; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="margin-top: 0; color: #0f172a;">Leave Request Update</h2>
        <p>Dear <strong>{employee_name}</strong>,</p>
        <p>Your <strong>{leave_type}</strong> leave request has been reviewed:</p>
        
        <p><span class="status-badge">{status}</span></p>

        {comment_html}

        <p>You can check your updated leave quota and balance directly in the employee portal.</p>
        <div class="footer">
          &copy; HCM Lite Enterprise Human Capital Management.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Dear {employee_name},\n\n"
        f"Your {leave_type} leave request status is: {status}.\n"
        + (f"HR Comment: {hr_comment}\n" if hr_comment else "")
        + "\nPlease check the HCM portal for details."
    )
    return send_email(to_email, subject, html_content, plain_text)


def send_payslip_notification_email(
    to_email: str,
    employee_name: str,
    month: str,
    net_salary: float,
) -> bool:
    """
    Notify an employee that their monthly payslip has been finalized and published.
    """
    subject = f"Payslip Available: {month} - HCM Lite"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }}
        .card {{ background-color: #ffffff; max-width: 580px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }}
        .header {{ border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }}
        .logo-title {{ font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin: 0; }}
        .logo-blue {{ color: #0066ff; }}
        .tagline {{ font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }}
        .salary-box {{ background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center; }}
        .amount {{ font-size: 28px; font-weight: 800; color: #15803d; margin: 8px 0; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; }}
        .btn {{ display: inline-block; background-color: #0066ff; color: #ffffff !important; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 8px; }}
        .footer {{ margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="logo-title">HCM<span class="logo-blue">Lite</span></h1>
          <div class="tagline">Smarter HR. Happier Teams.</div>
        </div>
        <h2 style="margin-top: 0; color: #0f172a; font-size: 18px;">Monthly Payslip Issued &bull; {month}</h2>
        <p>Dear <strong>{employee_name}</strong>,</p>
        <p>Your electronic payslip for the payroll period <strong>{month}</strong> has been finalized and approved by administration.</p>
        
        <div class="salary-box">
          <div style="font-size: 12px; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Net Disbursed Compensation</div>
          <div class="amount">PKR {net_salary:,.2f}</div>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="http://localhost:3000/employee/payslips" class="btn">View & Download PDF Payslip</a>
        </div>

        <p style="font-size: 13px; color: #64748b;">You can view detailed allowance breakdowns, tax deductions, and download your official PDF payslip directly in the employee portal.</p>
        <div class="footer">
          &copy; HCM Lite &bull; Smarter HR. Happier Teams.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Dear {employee_name},\n\n"
        f"Your payslip for period {month} is ready.\n"
        f"Net Disbursed Salary: PKR {net_salary:,.2f}\n\n"
        f"Please log in to your portal to download the detailed PDF breakdown:\n"
        f"http://localhost:3000/employee/payslips\n\n"
        f"Best regards,\nPayroll Department"
    )
    return send_email(to_email, subject, html_content, plain_text)


def send_otp_verification_email(
    to_email: str,
    user_name: str,
    otp_code: str,
    minutes_valid: int = 10,
) -> bool:
    """
    Send a 4-digit verification security code for password reset / change.
    """
    subject = f"Security Code: {otp_code} - HCM Lite Verification"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }}
        .card {{ background-color: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }}
        .header {{ border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }}
        .logo-title {{ font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin: 0; }}
        .logo-blue {{ color: #0066ff; }}
        .otp-box {{ background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); border: 2px dashed #0066ff; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center; }}
        .otp-code {{ font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 800; color: #0066ff; letter-spacing: 12px; margin: 4px 0; }}
        .info-note {{ font-size: 13px; color: #64748b; line-height: 1.5; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="logo-title">HCM<span class="logo-blue">Lite</span></h1>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Verification Code</h2>
        <p>Hello <strong>{user_name}</strong>,</p>
        <p>You requested to update your account password. Use the single-use 4-digit verification code below to authorize this change:</p>

        <div class="otp-box">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 4px;">4-Digit Security Code</div>
          <div class="otp-code">{otp_code}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Valid for <strong>{minutes_valid} minutes</strong></div>
        </div>

        <p class="info-note">
          If you did not request this verification code, please ignore this email or notify your system administrator immediately. Do not share this code with anyone.
        </p>

        <div class="footer">
          &copy; HCM Lite &bull; Security & Identity Protection.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Hello {user_name},\n\n"
        f"Your HCM Lite password verification code is: {otp_code}\n\n"
        f"This code will expire in {minutes_valid} minutes.\n"
        f"If you did not make this request, please ignore this email.\n\n"
        f"Best regards,\nHCM Security Team"
    )
    return send_email(to_email, subject, html_content, plain_text)


def send_password_changed_confirmation_email(
    to_email: str,
    user_name: str,
) -> bool:
    """
    Notify user that their password has been successfully updated.
    """
    subject = "Security Alert: Account Password Changed - HCM Lite"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }}
        .card {{ background-color: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }}
        .header {{ border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }}
        .logo-title {{ font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin: 0; }}
        .logo-blue {{ color: #0066ff; }}
        .success-box {{ background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0; color: #15803d; font-size: 14px; font-weight: 600; text-align: center; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1 class="logo-title">HCM<span class="logo-blue">Lite</span></h1>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Successfully Updated</h2>
        <p>Hello <strong>{user_name}</strong>,</p>
        <div class="success-box">
          ✓ Your account password was successfully updated.
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          You can now sign in with your new password. If you did not make this change, please contact system administration immediately to lock your account.
        </p>
        <div class="footer">
          &copy; HCM Lite &bull; Security & Identity Protection.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Hello {user_name},\n\n"
        f"Your HCM Lite account password was successfully updated.\n"
        f"If you did not perform this change, please contact system administration immediately.\n\n"
        f"Best regards,\nHCM Security Team"
    )
    return send_email(to_email, subject, html_content, plain_text)


def send_attendance_correction_email(
    to_email: str,
    employee_name: str,
    date_str: str,
    status: str,
    hr_comment: Optional[str] = None,
) -> bool:
    """
    Notify employee about attendance correction request status (Approved/Rejected).
    """
    subject = f"Attendance Correction Update: {status.upper()} ({date_str})"
    status_color = "#16a34a" if status.lower() == "approved" else "#dc2626"
    comment_html = f"<p><strong>HR Comment:</strong> {hr_comment}</p>" if hr_comment else ""

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
        .card {{ background-color: #ffffff; max-width: 540px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; }}
        .badge {{ display: inline-block; padding: 6px 14px; background-color: {status_color}; color: #ffffff; font-size: 13px; font-weight: 700; border-radius: 6px; text-transform: uppercase; }}
        .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2 style="margin-top: 0; color: #0f172a;">Attendance Correction Update</h2>
        <p>Dear <strong>{employee_name}</strong>,</p>
        <p>Your attendance correction request for date <strong>{date_str}</strong> has been reviewed:</p>
        
        <p><span class="badge">{status}</span></p>

        {comment_html}

        <p>Your attendance log and work hours have been updated accordingly in the system.</p>
        <div class="footer">
          &copy; HCM Lite &bull; Attendance Management.
        </div>
      </div>
    </body>
    </html>
    """
    plain_text = (
        f"Dear {employee_name},\n\n"
        f"Your attendance correction request for {date_str} has been {status}.\n"
        + (f"HR Comment: {hr_comment}\n" if hr_comment else "")
        + "\nPlease review your portal for details."
    )
    return send_email(to_email, subject, html_content, plain_text)
