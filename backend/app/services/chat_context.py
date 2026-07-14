import re
from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Advisor, RiskRule, Finding

MAX_ADVISORS_IN_CONTEXT = 50


def build_chat_context(db: Session, user_message: str) -> str:
    lines = ["=== DASHBOARD SUMMARY ==="]

    total = db.query(Advisor).count()
    grade_counts = {
        grade: db.query(Advisor).filter(Advisor.current_risk_grade == grade).count()
        for grade in ("critical", "high", "medium", "low")
    }
    efm_count = db.query(Advisor).filter(Advisor.enhanced_financial_monitoring.is_(True)).count()

    lines.append(f"Total advisors: {total}")
    lines.append(
        f"Risk distribution: Critical={grade_counts['critical']}, High={grade_counts['high']}, "
        f"Medium={grade_counts['medium']}, Low={grade_counts['low']}"
    )
    lines.append(f"Advisors with active Enhanced Financial Monitoring: {efm_count}")

    lines.append("\n=== CONFIGURED RISK RULES ===")
    rules = db.query(RiskRule).filter(RiskRule.is_active.is_(True)).all()
    for r in rules:
        lines.append(f"- {r.name} [{r.dataset}, {r.condition_type} > {r.threshold_value}] → {r.risk_grade.upper()}")

    lines.append(f"\n=== ADVISORS (top {MAX_ADVISORS_IN_CONTEXT} by risk score) ===")
    top_advisors = (
        db.query(Advisor)
        .order_by(Advisor.current_risk_score.desc())
        .limit(MAX_ADVISORS_IN_CONTEXT)
        .all()
    )
    for a in top_advisors:
        lines.append(
            f"- {a.full_name} ({a.advisor_ref}, {a.firm_name}): {a.current_risk_grade.upper()} "
            f"(score {a.current_risk_score:.1f}), EFM={'Yes' if a.enhanced_financial_monitoring else 'No'}"
        )

    matched_advisor = _find_mentioned_advisor(db, user_message)
    if matched_advisor:
        lines.append(f"\n=== FULL DETAIL: {matched_advisor.full_name} ({matched_advisor.advisor_ref}) ===")
        lines.append(_advisor_detail_text(db, matched_advisor))

    return "\n".join(lines)


def _find_mentioned_advisor(db: Session, message: str) -> Optional[Advisor]:
    ref_match = re.search(r"\bADV[\w-]*\d+\b", message, re.IGNORECASE)
    if ref_match:
        advisor = db.query(Advisor).filter(Advisor.advisor_ref.ilike(ref_match.group(0))).first()
        if advisor:
            return advisor

    message_lower = message.lower()
    for a in db.query(Advisor.id, Advisor.full_name).all():
        if a.full_name.lower() in message_lower:
            return db.query(Advisor).filter(Advisor.id == a.id).first()
    return None


def _advisor_detail_text(db: Session, advisor: Advisor) -> str:
    lines = []
    if advisor.mortgage_lender_spread:
        lines.append("Mortgage Lender Spread: " + ", ".join(
            f"{i.get('lender')} {i.get('percentage'):.1f}%" for i in advisor.mortgage_lender_spread
        ))
    if advisor.protection_provider_spread:
        lines.append("Protection Provider Spread: " + ", ".join(
            f"{i.get('provider')} {i.get('percentage'):.1f}%" for i in advisor.protection_provider_spread
        ))

    findings = (
        db.query(Finding)
        .filter(Finding.advisor_id == advisor.id)
        .order_by(Finding.created_at.desc())
        .limit(10)
        .all()
    )
    if findings:
        lines.append("Recent Findings:")
        for f in findings:
            source_tag = " (AI-suggested, unverified)" if f.source == "ai" else ""
            lines.append(f"  - [{f.risk_grade.upper()}]{source_tag} {f.title}: {f.description or ''}")

    return "\n".join(lines)
