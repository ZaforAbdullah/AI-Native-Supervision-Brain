import uuid
import logging
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.models import Advisor, RiskRule, AnalysisRun, Finding, AnalysisStatus
from app.agents.nra_agent import NRAAgent
from app.agents.edd_agent import EDDAgent
from app.agents.report_agent import ReportAgent
from app.services.risk_analysis import compute_advisor_risk_grade
from app.services.notifications import NotificationService

logger = logging.getLogger(__name__)


class SupervisionOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.nra_agent = NRAAgent(db)
        self.edd_agent = EDDAgent(db)
        self.report_agent = ReportAgent(db)
        self.notifier = NotificationService(db)

    def run_analysis(
        self,
        advisor_ids: Optional[List[int]] = None,
        trigger: str = "manual",
        triggered_by: Optional[int] = None,
    ) -> AnalysisRun:
        run_ref = f"NRA-{datetime.utcnow().strftime('%Y%m%d-%H%M')}-{str(uuid.uuid4())[:4].upper()}"

        analysis_run = AnalysisRun(
            run_ref=run_ref,
            status=AnalysisStatus.RUNNING,
            trigger=trigger,
            started_at=datetime.utcnow(),
            triggered_by=triggered_by,
        )
        self.db.add(analysis_run)
        self.db.commit()
        self.db.refresh(analysis_run)

        logger.info(f"Starting analysis run {run_ref} (trigger={trigger})")

        try:
            q = self.db.query(Advisor).filter(Advisor.status == "active")
            if advisor_ids:
                q = q.filter(Advisor.id.in_(advisor_ids))
            advisors = q.all()

            rules = self.db.query(RiskRule).filter(RiskRule.is_active == True).all()
            logger.info(f"Analysing {len(advisors)} advisors against {len(rules)} active rules")

            all_findings: dict[int, List[Finding]] = {}
            edd_notes: dict[int, str] = {}
            total_risks = 0
            high_count = 0
            critical_count = 0

            for advisor in advisors:
                findings = self.nra_agent.analyse_advisor(advisor, rules, analysis_run.id)

                if findings:
                    for finding in findings:
                        self.db.add(finding)
                    self.db.flush()

                    edd_required = any(f.requires_edd for f in findings)
                    if edd_required:
                        edd_text = self.edd_agent.perform_edd(advisor, findings)
                        if edd_text:
                            edd_notes[advisor.id] = edd_text
                            for f in findings:
                                if f.requires_edd:
                                    f.edd_completed = True
                                    f.edd_notes = edd_text[:500]

                    grade, score = compute_advisor_risk_grade(findings)
                    advisor.current_risk_grade = grade
                    advisor.current_risk_score = score
                    advisor.last_analysed_at = datetime.utcnow()

                    all_findings[advisor.id] = findings
                    total_risks += len(findings)
                    if grade == "critical":
                        critical_count += 1
                    elif grade == "high":
                        high_count += 1
                else:
                    advisor.current_risk_grade = "low"
                    advisor.current_risk_score = 0.0
                    advisor.last_analysed_at = datetime.utcnow()

            self.db.flush()

            report = self.report_agent.generate_network_report(
                analysis_run, advisors, all_findings, edd_notes
            )

            analysis_run.status = AnalysisStatus.COMPLETED
            analysis_run.completed_at = datetime.utcnow()
            analysis_run.advisors_analysed = len(advisors)
            analysis_run.risks_identified = total_risks
            analysis_run.high_risk_count = high_count
            analysis_run.critical_risk_count = critical_count
            self.db.commit()

            if critical_count > 0 or high_count > 0:
                try:
                    self.notifier.send_analysis_alert(analysis_run, report)
                except Exception as e:
                    logger.warning(f"Notification failed: {e}")

            logger.info(
                f"Run {run_ref} completed: {len(advisors)} advisors, "
                f"{total_risks} findings, {critical_count} critical, {high_count} high"
            )

        except Exception as e:
            logger.error(f"Analysis run {run_ref} failed: {e}", exc_info=True)
            analysis_run.status = AnalysisStatus.FAILED
            analysis_run.error_message = str(e)
            analysis_run.completed_at = datetime.utcnow()
            self.db.commit()

        return analysis_run
