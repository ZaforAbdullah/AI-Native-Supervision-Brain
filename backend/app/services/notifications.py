import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import User, AnalysisRun, SupervisionReport, SystemConfig
from app.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def send_analysis_alert(self, run: AnalysisRun, report: Optional[SupervisionReport] = None):
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.info("SMTP not configured — skipping email notification")
            return

        recipients = (
            self.db.query(User)
            .filter(User.receive_alerts == True, User.is_active == True)
            .all()
        )
        if not recipients:
            return

        subject = (
            f"[SUPERVISION ALERT] Analysis Run {run.run_ref} — "
            f"{run.critical_risk_count} Critical, {run.high_risk_count} High Risk Advisors Identified"
        )

        body = f"""Supervision Brain Analysis Complete

Run Reference: {run.run_ref}
Completed: {run.completed_at.strftime('%d %B %Y %H:%M UTC') if run.completed_at else 'N/A'}

Summary:
  Advisors Analysed: {run.advisors_analysed}
  Total Risk Findings: {run.risks_identified}
  Critical Risk: {run.critical_risk_count}
  High Risk: {run.high_risk_count}

{"Report Reference: " + report.report_ref if report else ""}

Please log in to the Supervision Dashboard to review the full report and take any required actions.

---
This is an automated alert from the AI Supervision Brain system.
"""

        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart()
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = ", ".join(r.email for r in recipients)
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [r.email for r in recipients], msg.as_string())

            logger.info(f"Alert email sent to {len(recipients)} recipients for run {run.run_ref}")

        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")
