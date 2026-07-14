# Never persists anything — returns a draft only, caller decides whether to save it.
from typing import Any, Dict
from app.services.ai_client import get_ai_client, parse_json_response

VALID_GRADES = {"low", "medium", "high", "critical"}

# Mirrors risk_analysis.DATASET_EVALUATORS — the only pairs the rule engine can evaluate.
ALLOWED_PAIRS: Dict[str, str] = {
    "mortgage_lender_spread": "max_concentration_gt",
    "protection_provider_spread": "max_concentration_gt",
    "file_review_results": "poor_review_rate_gt",
    "file_review_deficiencies": "deficiency_with_concentration",
    "enhanced_financial_monitoring": "efm_with_high_commission",
}


class RuleAuthorAgent:
    def __init__(self):
        self.ai = get_ai_client()

    def draft_rule(self, description: str) -> Dict[str, Any]:
        if not self.ai.available:
            raise RuntimeError("AI provider not configured")

        prompt = self._build_prompt(description)
        raw = self.ai.generate(prompt, max_tokens=500, json_mode=True)
        data = parse_json_response(raw)
        if data is None:
            raw = self.ai.generate(prompt + "\n\nReturn ONLY valid JSON. No other text.", max_tokens=500, json_mode=True)
            data = parse_json_response(raw)
        if not isinstance(data, dict):
            raise ValueError("AI did not return a valid rule draft — try rephrasing the description")

        return self._validate(data)

    def _build_prompt(self, description: str) -> str:
        pairs_text = "\n".join(f'  - dataset="{d}", condition_type="{c}"' for d, c in ALLOWED_PAIRS.items())
        return f"""You are configuring a compliance risk rule for a Network Risk Analysis system.

The rule engine only supports these exact (dataset, condition_type) pairs — you MUST pick one:
{pairs_text}

User's plain-English rule description:
"{description}"

Map this description onto the closest matching (dataset, condition_type) pair above, then produce a
threshold_value that fits the description (as a plain number — if the description mentions a percentage,
use the numeric value e.g. 50 for "50%"). Choose risk_grade from low/medium/high/critical based on the
severity implied. Set requires_edd to true if the description implies a serious/critical concern.

Respond with ONLY this JSON object (no prose, no markdown fences):
{{
  "name": "short rule name",
  "description": "one sentence description",
  "dataset": "one of the datasets above",
  "condition_type": "the matching condition_type above",
  "threshold_value": <number>,
  "risk_grade": "low|medium|high|critical",
  "risk_weight": <number, default 1.0>,
  "requires_edd": <true|false>,
  "ai_prompt_hint": "a short hint for the AI analyst reviewing findings from this rule"
}}"""

    def _validate(self, data: Dict[str, Any]) -> Dict[str, Any]:
        dataset = str(data.get("dataset", "")).strip()
        condition_type = str(data.get("condition_type", "")).strip()
        if dataset not in ALLOWED_PAIRS or ALLOWED_PAIRS[dataset] != condition_type:
            raise ValueError(
                f"AI produced an unsupported dataset/condition_type pair ({dataset!r}, {condition_type!r}) — "
                "try rephrasing the description to more clearly match one of the supported risk datasets"
            )

        risk_grade = str(data.get("risk_grade", "")).strip().lower()
        if risk_grade not in VALID_GRADES:
            raise ValueError(f"AI produced an invalid risk_grade: {risk_grade!r}")

        try:
            threshold_value = float(data.get("threshold_value"))
        except (TypeError, ValueError):
            raise ValueError("AI did not produce a numeric threshold_value")

        try:
            risk_weight = float(data.get("risk_weight", 1.0))
        except (TypeError, ValueError):
            risk_weight = 1.0
        risk_weight = max(0.1, min(risk_weight, 5.0))
        threshold_value = max(0.0, min(threshold_value, 100.0))

        name = str(data.get("name", "")).strip() or "Untitled AI-Drafted Rule"

        return {
            "name": name,
            "description": str(data.get("description", "")).strip() or None,
            "dataset": dataset,
            "condition_type": condition_type,
            "threshold_value": threshold_value,
            "threshold_unit": "percent",
            "risk_grade": risk_grade,
            "risk_weight": risk_weight,
            "is_active": True,
            "requires_edd": bool(data.get("requires_edd", False)),
            "ai_prompt_hint": str(data.get("ai_prompt_hint", "")).strip() or None,
        }
