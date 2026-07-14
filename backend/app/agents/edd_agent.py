from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import Advisor, Finding
from app.services.ai_client import get_ai_client
import logging

logger = logging.getLogger(__name__)


class EDDAgent:
    def __init__(self, db: Session):
        self.db = db
        self.ai = get_ai_client()

    def perform_edd(self, advisor: Advisor, findings: List[Finding]) -> str:
        edd_findings = [f for f in findings if f.requires_edd]
        if not edd_findings:
            return ""

        if self.ai.available:
            result = self._ai_edd(advisor, edd_findings)
            if result:
                return result

        return self._rule_based_edd(advisor, edd_findings)

    def _build_full_context(self, advisor: Advisor, findings: List[Finding]) -> str:
        lines = []
        lines.append(f"=== EDD Report: {advisor.full_name} (Ref: {advisor.advisor_ref}) ===")
        lines.append(f"Firm: {advisor.firm_name} | Status: {advisor.status}")
        lines.append("")

        if advisor.mortgage_lender_spread:
            lines.append("MORTGAGE LENDER SPREAD (12-month rolling):")
            for item in sorted(advisor.mortgage_lender_spread, key=lambda x: x.get("percentage", 0), reverse=True):
                lines.append(f"  {item.get('lender')}: {item.get('percentage'):.1f}% ({item.get('case_count')} cases)")

        if advisor.protection_provider_spread:
            lines.append("\nPROTECTION PROVIDER SPREAD (12-month rolling):")
            for item in sorted(advisor.protection_provider_spread, key=lambda x: x.get("percentage", 0), reverse=True):
                commission = item.get("avg_commission_rate", 0) or 0
                lines.append(
                    f"  {item.get('provider')}: {item.get('percentage'):.1f}% "
                    f"({item.get('case_count')} cases, ~{commission*100:.1f}% commission)"
                )

        if advisor.file_review_results:
            lines.append("\nFILE REVIEW HISTORY (last 12 months):")
            for r in advisor.file_review_results[-6:]:
                rate = (r.get("failed", 0) / max(r.get("cases_reviewed", 1), 1)) * 100
                lines.append(
                    f"  {r.get('month')}: Grade {r.get('grade')} — "
                    f"{r.get('cases_reviewed')} reviewed, {r.get('failed')} failed ({rate:.0f}%)"
                )

        if advisor.file_review_deficiencies:
            lines.append("\nFILE REVIEW DEFICIENCIES:")
            for d in advisor.file_review_deficiencies:
                lines.append(
                    f"  {d.get('code')}: {d.get('description')} — {d.get('count')} instances "
                    f"(linked lender: {d.get('lender_related', 'N/A')})"
                )

        lines.append(
            f"\nENHANCED FINANCIAL MONITORING: {'ACTIVE' if advisor.enhanced_financial_monitoring else 'Clear'}"
        )

        lines.append("\nNRA FINDINGS TRIGGERING EDD:")
        for f in findings:
            lines.append(f"  [{f.risk_grade.upper()}] {f.title}")
            if f.description:
                lines.append(f"    {f.description}")

        return "\n".join(lines)

    def _ai_edd(self, advisor: Advisor, findings: List[Finding]) -> str:
        context = self._build_full_context(advisor, findings)
        prompt = f"""You are a senior compliance officer performing Enhanced Due Diligence (EDD)
on an advisor who has been flagged during Network Risk Analysis.

{context}

Produce a structured EDD report with the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences: overall risk picture)
2. CROSS-DATASET ANALYSIS (identify patterns across the different data sources)
3. REGULATORY CONCERN ASSESSMENT (evaluate against suitability, customer outcome, and conflicts of interest principles)
4. RISK RATING JUSTIFICATION (explain why the current risk grade is appropriate)
5. RECOMMENDED ACTIONS (specific, prioritised steps for the supervision team)

Use professional compliance language. Be specific about which data points are most concerning and why."""

        return self.ai.generate(prompt, max_tokens=1500) or ""

    def _rule_based_edd(self, advisor: Advisor, findings: List[Finding]) -> str:
        lines = ["ENHANCED DUE DILIGENCE REPORT", "=" * 40, ""]

        grade_counts: Dict[str, int] = {}
        for f in findings:
            grade_counts[f.risk_grade] = grade_counts.get(f.risk_grade, 0) + 1

        if grade_counts.get("critical", 0) > 0:
            lines.append("EXECUTIVE SUMMARY: This advisor presents CRITICAL risk indicators requiring immediate")
            lines.append("intervention. The combination of flagged risk factors suggests potential customer harm.")
        elif grade_counts.get("high", 0) > 0:
            lines.append("EXECUTIVE SUMMARY: This advisor presents HIGH risk indicators. Prompt supervisory")
            lines.append("engagement is required to assess and remediate identified concerns.")
        else:
            lines.append("EXECUTIVE SUMMARY: Medium-level risk indicators identified. Enhanced monitoring")
            lines.append("is recommended with a follow-up review within 30 days.")

        lines.extend(["", "FINDINGS REQUIRING EDD:"])
        for f in findings:
            lines.append(f"  [{f.risk_grade.upper()}] {f.title}")
            if f.description:
                lines.append(f"  Detail: {f.description}")
            lines.append("")

        lines.append("RECOMMENDED ACTIONS:")
        if advisor.enhanced_financial_monitoring:
            lines.append("  1. URGENT: Review all protection cases placed in the last 90 days for suitability")
            lines.append("  2. Conduct an immediate interview with the advisor")
            lines.append("  3. Cross-reference commission payments with case outcomes")
        else:
            lines.append("  1. Schedule a supervision interview within 14 days")
            lines.append("  2. Pull and review a sample of cases from the highest-concentration lender/provider")
            lines.append("  3. Assess whether suitability documentation adequately justifies placement decisions")

        lines.append("  4. Consider enhanced file review frequency (monthly vs quarterly)")
        lines.append("  5. Document all findings and actions in the compliance management system")

        return "\n".join(lines)
