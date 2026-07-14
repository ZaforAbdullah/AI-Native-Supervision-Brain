from typing import List
from sqlalchemy.orm import Session
from app.models.models import Advisor, RiskRule, Finding
from app.services.risk_analysis import (
    evaluate_rules_for_advisor,
    calculate_poor_file_review_rate,
)
from app.services.ai_client import get_ai_client
import logging

logger = logging.getLogger(__name__)


class NRAAgent:
    def __init__(self, db: Session):
        self.db = db
        self.ai = get_ai_client()

    def analyse_advisor(
        self,
        advisor: Advisor,
        rules: List[RiskRule],
        analysis_run_id: int,
    ) -> List[Finding]:
        findings = evaluate_rules_for_advisor(advisor, rules, analysis_run_id)

        if self.ai.available and findings:
            findings = self._enrich_findings_with_ai(advisor, findings, rules)

        return findings

    def _build_advisor_summary(self, advisor: Advisor) -> str:
        lines = [
            f"Advisor: {advisor.full_name} (Ref: {advisor.advisor_ref}, Firm: {advisor.firm_name})"
        ]
        if advisor.mortgage_lender_spread:
            top = sorted(advisor.mortgage_lender_spread, key=lambda x: x.get("percentage", 0), reverse=True)[:3]
            lines.append("Mortgage Lender Spread (top 3): " + ", ".join(
                f"{i.get('lender')}: {i.get('percentage'):.1f}%" for i in top
            ))
        if advisor.protection_provider_spread:
            top = sorted(advisor.protection_provider_spread, key=lambda x: x.get("percentage", 0), reverse=True)[:3]
            lines.append("Protection Provider Spread (top 3): " + ", ".join(
                f"{i.get('provider')}: {i.get('percentage'):.1f}%" for i in top
            ))
        if advisor.file_review_results:
            rate = calculate_poor_file_review_rate(advisor.file_review_results)
            lines.append(f"File Review Failure Rate (12-month rolling): {rate:.1f}%")
        if advisor.file_review_deficiencies:
            codes = [f"{d.get('code')} ({d.get('count')}x)" for d in advisor.file_review_deficiencies[:5]]
            lines.append("File Deficiency Codes: " + ", ".join(codes))
        lines.append(
            f"Enhanced Financial Monitoring Flag: {'YES' if advisor.enhanced_financial_monitoring else 'No'}"
        )
        return "\n".join(lines)

    def _enrich_findings_with_ai(self, advisor: Advisor, findings: List[Finding], rules: List[RiskRule]) -> List[Finding]:
        hints_by_rule_id = {r.id: r.ai_prompt_hint for r in rules if r.ai_prompt_hint}
        advisor_summary = self._build_advisor_summary(advisor)
        findings_summary = "\n".join(
            f"- [{f.risk_grade.upper()}] {f.title}: {f.description}"
            + (f" | Hint: {hints_by_rule_id[f.rule_id]}" if f.rule_id in hints_by_rule_id else "")
            for f in findings
        )
        prompt = f"""You are a compliance supervision analyst reviewing an advisor risk assessment.

Advisor Data:
{advisor_summary}

Rule-Based Findings:
{findings_summary}

For each finding, provide a concise (2-3 sentence) professional analysis explaining:
1. Why this finding is significant from a regulatory/customer outcome perspective
2. Any patterns or combinations that increase concern
3. Recommended immediate action

Format your response as a numbered list matching the order of findings above.
Be precise, use supervision/compliance terminology, and focus on customer outcome risk."""

        ai_text = self.ai.generate(prompt, max_tokens=1000)

        if ai_text:
            paragraphs = [p.strip() for p in ai_text.split("\n") if p.strip()]
            numbered = [p for p in paragraphs if p and (p[0].isdigit() or p.startswith("-"))]
            for i, finding in enumerate(findings):
                if i < len(numbered):
                    finding.ai_analysis = numbered[i].lstrip("0123456789.-) ").strip()
                else:
                    finding.ai_analysis = self._fallback_analysis(finding)
        else:
            for finding in findings:
                finding.ai_analysis = self._fallback_analysis(finding)

        return findings

    def _fallback_analysis(self, finding: Finding) -> str:
        templates = {
            "lender_concentration": (
                "High concentration with a single lender may indicate limited market access or "
                "adviser bias. This requires review to ensure clients are receiving best-outcome advice."
            ),
            "provider_concentration": (
                "Significant protection business placed with one provider warrants scrutiny to "
                "confirm suitability assessments are customer-led rather than commission-influenced."
            ),
            "file_review_quality": (
                "Elevated file review failure rate suggests process or competency concerns. "
                "Enhanced supervision and targeted training should be considered."
            ),
            "deficiency_concentration_combo": (
                "The combination of deficiency codes and high lender concentration is a compounding "
                "risk indicator. EDD is recommended to determine if cases demonstrate suitability failures."
            ),
            "efm_commission_concern": (
                "CRITICAL: An active financial monitoring flag combined with high-commission provider "
                "placement is a serious indicator of potential conflicts of interest. Immediate review required."
            ),
        }
        return templates.get(
            finding.finding_type,
            "This finding requires supervisory attention. Review the advisor's recent case history for patterns."
        )
