from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.models import Advisor, RiskRule, Finding, AnalysisRun, RiskGrade
import json


RISK_SCORE_MAP = {
    "low": 1.0,
    "medium": 3.0,
    "high": 7.0,
    "critical": 10.0,
}

HIGH_COMMISSION_PROVIDERS = {
    "ProviderA": 0.085,
    "ProviderB": 0.092,
    "ProviderC": 0.078,
    "ProviderD": 0.095,
    "ProviderE": 0.071,
}
HIGH_COMMISSION_THRESHOLD = 0.075


def calculate_max_concentration(spread_data: List[Dict]) -> Tuple[float, str]:
    if not spread_data:
        return 0.0, ""
    max_item = max(spread_data, key=lambda x: x.get("percentage", 0))
    return max_item.get("percentage", 0.0), max_item.get("lender") or max_item.get("provider", "")


def calculate_poor_file_review_rate(file_results: List[Dict]) -> float:
    if not file_results:
        return 0.0
    total = sum(r.get("cases_reviewed", 0) for r in file_results)
    failed = sum(r.get("failed", 0) for r in file_results)
    if total == 0:
        return 0.0
    return (failed / total) * 100


def get_worst_file_grade(file_results: List[Dict]) -> str:
    grade_order = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
    grades = [r.get("grade", "A") for r in file_results if r.get("grade")]
    if not grades:
        return "A"
    return min(grades, key=lambda g: grade_order.get(g, 3))


def check_efm_high_commission(advisor: Advisor) -> Tuple[bool, List[str]]:
    if not advisor.enhanced_financial_monitoring:
        return False, []
    if not advisor.protection_provider_spread:
        return False, []
    high_commission_providers = []
    for item in advisor.protection_provider_spread:
        provider = item.get("provider", "")
        rate = HIGH_COMMISSION_PROVIDERS.get(provider, 0)
        pct = item.get("percentage", 0)
        if rate >= HIGH_COMMISSION_THRESHOLD and pct >= 20:
            high_commission_providers.append(f"{provider} ({pct:.1f}% of cases, {rate*100:.1f}% commission)")
    return len(high_commission_providers) > 0, high_commission_providers


def check_deficiency_with_concentration(advisor: Advisor) -> Tuple[bool, List[str]]:
    if not advisor.file_review_deficiencies or not advisor.mortgage_lender_spread:
        return False, []
    max_lender_pct, max_lender = calculate_max_concentration(advisor.mortgage_lender_spread)
    if max_lender_pct < 40:
        return False, []
    concerning_codes = ["DEF001", "DEF002", "DEF005", "DEF008", "DEF012"]
    found = []
    for deficiency in advisor.file_review_deficiencies:
        if deficiency.get("code") in concerning_codes and deficiency.get("count", 0) > 0:
            found.append(
                f"{deficiency.get('code')}: {deficiency.get('description')} "
                f"(count: {deficiency.get('count')}, related lender: {deficiency.get('lender_related', 'N/A')})"
            )
    return len(found) > 0, found


def _build_finding(
    rule: RiskRule,
    advisor: Advisor,
    analysis_run_id: int,
    finding_type: str,
    title: str,
    description: str,
    evidence: Dict[str, Any],
    triggered_value: Optional[float] = None,
    risk_grade: Optional[str] = None,
    requires_edd: Optional[bool] = None,
) -> Finding:
    risk_grade = risk_grade or rule.risk_grade
    return Finding(
        analysis_run_id=analysis_run_id,
        advisor_id=advisor.id,
        rule_id=rule.id,
        finding_type=finding_type,
        risk_grade=risk_grade,
        risk_score=RISK_SCORE_MAP.get(risk_grade, 1.0) * rule.risk_weight,
        title=title,
        description=description,
        evidence=evidence,
        triggered_value=triggered_value,
        threshold_value=rule.threshold_value,
        requires_edd=rule.requires_edd if requires_edd is None else requires_edd,
    )


def _evaluate_mortgage_lender_concentration(
    rule: RiskRule, advisor: Advisor, analysis_run_id: int
) -> Optional[Finding]:
    if not advisor.mortgage_lender_spread or rule.condition_type != "max_concentration_gt":
        return None

    max_pct, max_lender = calculate_max_concentration(advisor.mortgage_lender_spread)
    if max_pct <= rule.threshold_value:
        return None

    return _build_finding(
        rule, advisor, analysis_run_id,
        finding_type="lender_concentration",
        title=f"High Mortgage Lender Concentration: {max_lender}",
        description=(
            f"Advisor placed {max_pct:.1f}% of mortgage cases with {max_lender}, "
            f"exceeding the {rule.threshold_value:.0f}% threshold."
        ),
        evidence={
            "lender": max_lender,
            "concentration_pct": max_pct,
            "full_spread": advisor.mortgage_lender_spread,
        },
        triggered_value=max_pct,
    )


def _evaluate_protection_provider_concentration(
    rule: RiskRule, advisor: Advisor, analysis_run_id: int
) -> Optional[Finding]:
    if not advisor.protection_provider_spread or rule.condition_type != "max_concentration_gt":
        return None

    max_pct, max_provider = calculate_max_concentration(advisor.protection_provider_spread)
    if max_pct <= rule.threshold_value:
        return None

    return _build_finding(
        rule, advisor, analysis_run_id,
        finding_type="provider_concentration",
        title=f"High Protection Provider Concentration: {max_provider}",
        description=(
            f"Advisor placed {max_pct:.1f}% of protection cases with {max_provider}, "
            f"exceeding the {rule.threshold_value:.0f}% threshold."
        ),
        evidence={
            "provider": max_provider,
            "concentration_pct": max_pct,
            "full_spread": advisor.protection_provider_spread,
        },
        triggered_value=max_pct,
    )


def _evaluate_file_review_quality(
    rule: RiskRule, advisor: Advisor, analysis_run_id: int
) -> Optional[Finding]:
    if not advisor.file_review_results or rule.condition_type != "poor_review_rate_gt":
        return None

    poor_rate = calculate_poor_file_review_rate(advisor.file_review_results)
    if poor_rate <= rule.threshold_value:
        return None

    worst_grade = get_worst_file_grade(advisor.file_review_results)
    return _build_finding(
        rule, advisor, analysis_run_id,
        finding_type="file_review_quality",
        title=f"Elevated File Review Failure Rate ({poor_rate:.1f}%)",
        description=(
            f"File review failure rate of {poor_rate:.1f}% exceeds threshold of "
            f"{rule.threshold_value:.0f}%. Worst grade recorded: {worst_grade}."
        ),
        evidence={
            "failure_rate": poor_rate,
            "worst_grade": worst_grade,
            "review_history": advisor.file_review_results,
        },
        triggered_value=poor_rate,
    )


def _evaluate_deficiency_with_concentration(
    rule: RiskRule, advisor: Advisor, analysis_run_id: int
) -> Optional[Finding]:
    if rule.condition_type != "deficiency_with_concentration":
        return None

    triggered, deficiency_details = check_deficiency_with_concentration(advisor)
    if not triggered:
        return None

    return _build_finding(
        rule, advisor, analysis_run_id,
        finding_type="deficiency_concentration_combo",
        title="File Deficiencies with High Lender Concentration",
        description=(
            "Concerning deficiency codes identified alongside high lender concentration, "
            "suggesting possible product suitability concerns."
        ),
        evidence={
            "deficiencies": deficiency_details,
            "mortgage_spread": advisor.mortgage_lender_spread,
        },
    )


def _evaluate_efm_high_commission(
    rule: RiskRule, advisor: Advisor, analysis_run_id: int
) -> Optional[Finding]:
    if rule.condition_type != "efm_with_high_commission":
        return None

    triggered, providers = check_efm_high_commission(advisor)
    if not triggered:
        return None

    return _build_finding(
        rule, advisor, analysis_run_id,
        finding_type="efm_commission_concern",
        title="EFM Flag with High-Commission Provider Placement",
        description=(
            "Advisor has an active Enhanced Financial Monitoring flag (potential solvency concern) "
            "AND is placing significant protection business with high-commission providers. "
            "This combination may indicate remuneration-driven advice rather than customer outcome."
        ),
        evidence={
            "efm_flag": True,
            "high_commission_providers": providers,
            "protection_spread": advisor.protection_provider_spread,
        },
        risk_grade="critical",
        requires_edd=True,
    )


DATASET_EVALUATORS = {
    "mortgage_lender_spread": _evaluate_mortgage_lender_concentration,
    "protection_provider_spread": _evaluate_protection_provider_concentration,
    "file_review_results": _evaluate_file_review_quality,
    "file_review_deficiencies": _evaluate_deficiency_with_concentration,
    "enhanced_financial_monitoring": _evaluate_efm_high_commission,
}


def evaluate_rules_for_advisor(
    advisor: Advisor,
    rules: List[RiskRule],
    analysis_run_id: int,
) -> List[Finding]:
    findings: List[Finding] = []

    for rule in rules:
        if not rule.is_active:
            continue

        evaluator = DATASET_EVALUATORS.get(rule.dataset)
        if evaluator is None:
            continue

        finding = evaluator(rule, advisor, analysis_run_id)
        if finding:
            findings.append(finding)

    return findings


def compute_advisor_risk_grade(findings: List[Finding]) -> Tuple[str, float]:
    if not findings:
        return "low", 0.0

    grades = [f.risk_grade for f in findings]
    total_score = sum(f.risk_score for f in findings)

    if "critical" in grades:
        return "critical", min(total_score, 10.0)
    if "high" in grades:
        return "high", min(total_score, 8.0)
    if "medium" in grades:
        return "medium", min(total_score, 5.0)
    return "low", min(total_score, 2.0)
