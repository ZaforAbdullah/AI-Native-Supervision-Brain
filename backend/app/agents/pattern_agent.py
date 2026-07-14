# Advisory only — never touches Advisor.current_risk_grade/current_risk_score.
import logging
import uuid
from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from app.models.models import Advisor, Finding, AnalysisRun, AnalysisStatus
from app.services.ai_client import get_ai_client, parse_json_response
from app.services.risk_analysis import RISK_SCORE_MAP

logger = logging.getLogger(__name__)

VALID_GRADES = {"low", "medium", "high", "critical"}
MAX_PATTERNS = 3


class PatternDiscoveryAgent:
    def __init__(self, db: Session):
        self.db = db
        self.ai = get_ai_client()

    def discover_patterns(self, advisor: Advisor) -> List[Finding]:
        if not self.ai.available:
            return []

        prompt = self._build_prompt(advisor)
        raw = self.ai.generate(prompt, max_tokens=800, json_mode=True)
        items = parse_json_response(raw)
        if items is None:
            raw = self.ai.generate(prompt + "\n\nReturn ONLY valid JSON. No other text.", max_tokens=800, json_mode=True)
            items = parse_json_response(raw)
        if not isinstance(items, list):
            return []

        validated = []
        for item in items[:MAX_PATTERNS]:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()
            grade = str(item.get("risk_grade", "")).strip().lower()
            if not title or grade not in VALID_GRADES:
                continue
            validated.append({
                "title": title,
                "grade": grade,
                "description": str(item.get("description", "")).strip() or None,
                "rationale": str(item.get("rationale", "")).strip(),
            })

        if not validated:
            return []

        run = self._create_audit_run(advisor, len(validated))

        findings = [
            Finding(
                analysis_run_id=run.id,
                advisor_id=advisor.id,
                rule_id=None,
                source="ai",
                finding_type="ai_discovered",
                risk_grade=item["grade"],
                risk_score=RISK_SCORE_MAP.get(item["grade"], 1.0),
                title=item["title"],
                description=item["description"],
                evidence={"rationale": item["rationale"]},
                requires_edd=False,
            )
            for item in validated
        ]
        self.db.add_all(findings)
        self.db.commit()
        for f in findings:
            self.db.refresh(f)

        return findings

    def _create_audit_run(self, advisor: Advisor, finding_count: int) -> AnalysisRun:
        run = AnalysisRun(
            run_ref=f"AIP-{datetime.utcnow().strftime('%Y%m%d-%H%M')}-{str(uuid.uuid4())[:4].upper()}",
            status=AnalysisStatus.COMPLETED,
            trigger="ai_pattern_discovery",
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            advisors_analysed=1,
            risks_identified=finding_count,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def _build_prompt(self, advisor: Advisor) -> str:
        existing = (
            self.db.query(Finding)
            .filter(Finding.advisor_id == advisor.id, Finding.source == "rule")
            .order_by(Finding.created_at.desc())
            .limit(10)
            .all()
        )

        lines = [f"Advisor: {advisor.full_name} (Ref: {advisor.advisor_ref}, Firm: {advisor.firm_name})"]

        if advisor.mortgage_lender_spread:
            lines.append("MORTGAGE LENDER SPREAD:")
            for item in sorted(advisor.mortgage_lender_spread, key=lambda x: x.get("percentage", 0), reverse=True):
                lines.append(f"  {item.get('lender')}: {item.get('percentage'):.1f}% ({item.get('case_count')} cases)")

        if advisor.protection_provider_spread:
            lines.append("PROTECTION PROVIDER SPREAD:")
            for item in sorted(advisor.protection_provider_spread, key=lambda x: x.get("percentage", 0), reverse=True):
                commission = item.get("avg_commission_rate", 0) or 0
                lines.append(
                    f"  {item.get('provider')}: {item.get('percentage'):.1f}% "
                    f"({item.get('case_count')} cases, ~{commission * 100:.1f}% commission)"
                )

        if advisor.file_review_results:
            lines.append("FILE REVIEW HISTORY:")
            for r in advisor.file_review_results[-12:]:
                lines.append(
                    f"  {r.get('month')}: Grade {r.get('grade')} — "
                    f"{r.get('cases_reviewed')} reviewed, {r.get('failed')} failed"
                )

        if advisor.file_review_deficiencies:
            lines.append("FILE REVIEW DEFICIENCIES:")
            for d in advisor.file_review_deficiencies:
                lines.append(f"  {d.get('code')}: {d.get('description')} — {d.get('count')} instances")

        lines.append(f"ENHANCED FINANCIAL MONITORING: {'ACTIVE' if advisor.enhanced_financial_monitoring else 'Clear'}")

        if existing:
            lines.append("\nAlready Flagged (existing rule-based findings — do not restate these):")
            for f in existing:
                lines.append(f"  - [{f.risk_grade.upper()}] {f.title}")

        context = "\n".join(lines)

        return f"""You are a senior compliance analyst reviewing an advisor's full supervision data, looking
for risk patterns, trends, or cross-dataset correlations that a fixed set of threshold rules would NOT
catch — e.g. a gradual decline in file review quality that hasn't yet crossed a hard threshold, an unusual
combination across datasets, or a trend worth flagging for human review.

{context}

Do NOT restate findings listed above under "Already Flagged". Only surface genuinely new observations.
If you find nothing noteworthy beyond what's already flagged, return an empty array.

Respond with ONLY a JSON array (no prose, no markdown fences) of objects with this exact shape:
[{{"title": "short title", "description": "1-2 sentence explanation", "risk_grade": "low|medium|high|critical", "rationale": "why this matters"}}]

Return at most {MAX_PATTERNS} items."""
