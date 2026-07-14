# All names and data below are fictitious.
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import Advisor, RiskRule, User, SystemConfig
from app.api.routes.auth import hash_password

LENDERS = [
    "Nationwide", "Halifax", "Barclays", "HSBC", "Santander",
    "NatWest", "Virgin Money", "Accord", "Leeds BS", "West Brom"
]

PROVIDERS = [
    "ProviderA", "ProviderB", "ProviderC", "ProviderD", "ProviderE",
    "ProviderF", "ProviderG", "Legal & General", "Aviva", "Royal London"
]

HIGH_COMMISSION_PROVIDERS = {"ProviderA", "ProviderB", "ProviderC", "ProviderD"}

DEFICIENCY_CODES = [
    {"code": "DEF001", "description": "Inadequate suitability documentation"},
    {"code": "DEF002", "description": "Missing affordability assessment"},
    {"code": "DEF003", "description": "Incomplete fact find"},
    {"code": "DEF004", "description": "No evidence of product research"},
    {"code": "DEF005", "description": "Lender concentration not justified"},
    {"code": "DEF006", "description": "Missing client risk profile"},
    {"code": "DEF007", "description": "Insufficient protection needs analysis"},
    {"code": "DEF008", "description": "Provider concentration not justified"},
    {"code": "DEF009", "description": "Missing vulnerability assessment"},
    {"code": "DEF012", "description": "Commission disclosure incomplete"},
]

FIRMS = [
    "Apex Financial Solutions", "Meridian Mortgage Advisors", "Pinnacle Wealth Management",
    "Summit Financial Planning", "Horizon Advisory Group", "Clarity Financial Services",
    "Prestige Mortgage Solutions", "ProAdvice Financial", "Sterling Advisor Network",
    "Blueprint Financial Ltd", "Onyx Mortgage Group", "Solace Financial"
]

FIRST_NAMES = [
    "James", "Sarah", "Michael", "Emma", "David", "Claire", "Robert", "Helen",
    "John", "Karen", "Paul", "Lisa", "Mark", "Susan", "Andrew", "Rachel",
    "Chris", "Laura", "Matthew", "Julie", "Daniel", "Amanda", "Richard", "Natalie",
    "Thomas", "Rebecca", "Kevin", "Stephanie", "Stephen", "Catherine", "Gary", "Charlotte",
    "Simon", "Victoria", "Neil", "Samantha", "Craig", "Nicola", "Ian", "Alison"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Taylor", "Davies", "Evans",
    "Wilson", "Thomas", "Roberts", "Walker", "Wright", "Thompson", "Hughes", "Martin",
    "Lewis", "Robinson", "Hill", "Clarke", "Mitchell", "Green", "Harris", "White",
    "Anderson", "Jackson", "Moore", "Lee", "Turner", "Hall", "Ward", "Scott"
]


def _make_lender_spread(high_concentration: bool = False) -> list:
    if high_concentration:
        main_pct = random.uniform(55, 85)
        remaining = 100 - main_pct
        lenders = random.sample(LENDERS, min(5, len(LENDERS)))
        spread = [{"lender": lenders[0], "percentage": round(main_pct, 1),
                   "case_count": random.randint(15, 50)}]
        secondary = remaining * random.uniform(0.4, 0.7)
        tertiary = remaining - secondary
        spread.append({"lender": lenders[1], "percentage": round(secondary, 1),
                       "case_count": random.randint(3, 12)})
        spread.append({"lender": lenders[2], "percentage": round(tertiary, 1),
                       "case_count": random.randint(1, 5)})
    else:
        count = random.randint(4, 7)
        lenders = random.sample(LENDERS, count)
        pcts = [random.uniform(5, 35) for _ in lenders]
        total = sum(pcts)
        pcts = [round(p / total * 100, 1) for p in pcts]
        pcts[-1] = round(100 - sum(pcts[:-1]), 1)
        spread = [
            {"lender": l, "percentage": p, "case_count": random.randint(2, 20)}
            for l, p in zip(lenders, pcts)
        ]
    return sorted(spread, key=lambda x: x["percentage"], reverse=True)


def _make_provider_spread(high_concentration: bool = False, high_commission: bool = False) -> list:
    if high_commission:
        main_provider = random.choice(list(HIGH_COMMISSION_PROVIDERS))
        main_pct = random.uniform(45, 75)
        remaining = 100 - main_pct
        providers = [p for p in PROVIDERS if p != main_provider]
        secondary = random.choice(providers)
        spread = [
            {"provider": main_provider, "percentage": round(main_pct, 1),
             "case_count": random.randint(10, 35), "avg_commission_rate": 0.088,
             "is_high_commission": True},
            {"provider": secondary, "percentage": round(remaining * 0.6, 1),
             "case_count": random.randint(3, 10), "avg_commission_rate": 0.055,
             "is_high_commission": False},
            {"provider": random.choice(providers), "percentage": round(remaining * 0.4, 1),
             "case_count": random.randint(1, 5), "avg_commission_rate": 0.05,
             "is_high_commission": False},
        ]
    elif high_concentration:
        main_pct = random.uniform(55, 80)
        provider = random.choice(PROVIDERS)
        others = [p for p in PROVIDERS if p != provider][:3]
        spread = [{"provider": provider, "percentage": round(main_pct, 1),
                   "case_count": random.randint(10, 30), "avg_commission_rate": 0.065,
                   "is_high_commission": False}]
        remaining_pct = 100 - main_pct
        for i, p in enumerate(others):
            share = remaining_pct / len(others) if i < len(others) - 1 else remaining_pct - sum(
                x["percentage"] for x in spread[1:]
            )
            spread.append({"provider": p, "percentage": round(share, 1),
                           "case_count": random.randint(1, 8), "avg_commission_rate": 0.055,
                           "is_high_commission": False})
    else:
        count = random.randint(3, 6)
        providers = random.sample(PROVIDERS, count)
        pcts = [random.uniform(8, 40) for _ in providers]
        total = sum(pcts)
        pcts = [round(p / total * 100, 1) for p in pcts]
        pcts[-1] = round(100 - sum(pcts[:-1]), 1)
        spread = [
            {"provider": p, "percentage": pct, "case_count": random.randint(2, 15),
             "avg_commission_rate": round(random.uniform(0.04, 0.07), 3),
             "is_high_commission": p in HIGH_COMMISSION_PROVIDERS and pct > 20}
            for p, pct in zip(providers, pcts)
        ]
    return sorted(spread, key=lambda x: x["percentage"], reverse=True)


def _make_file_reviews(poor_quality: bool = False) -> list:
    grades_pool = ["A", "B", "C", "D"] if poor_quality else ["A", "A", "A", "B", "B", "C"]
    months = []
    base = datetime.utcnow() - timedelta(days=365)
    for i in range(12):
        month_date = base + timedelta(days=30 * i)
        cases = random.randint(5, 20)
        grade = random.choice(grades_pool)
        if poor_quality:
            fail_rate = random.uniform(0.3, 0.65)
        else:
            fail_rate = random.uniform(0.0, 0.2)
        failed = round(cases * fail_rate)
        months.append({
            "month": month_date.strftime("%b %Y"),
            "grade": grade,
            "cases_reviewed": cases,
            "passed": cases - failed,
            "failed": failed,
        })
    return months


def _make_deficiencies(with_concerning: bool = False) -> list:
    if with_concerning:
        codes = random.sample(DEFICIENCY_CODES, random.randint(2, 5))
        concerning = [c for c in codes if c["code"] in {"DEF001", "DEF002", "DEF005", "DEF008", "DEF012"}]
        if not concerning:
            codes[0] = random.choice([c for c in DEFICIENCY_CODES if c["code"] in {"DEF001", "DEF005", "DEF012"}])
    else:
        codes = random.sample(DEFICIENCY_CODES, random.randint(0, 2))
    return [
        {
            "code": c["code"],
            "description": c["description"],
            "count": random.randint(1, 8) if with_concerning else random.randint(0, 3),
            "lender_related": random.choice(LENDERS) if with_concerning else None,
        }
        for c in codes
        if with_concerning or random.random() > 0.3
    ]


def seed_sample_advisors(db: Session) -> int:
    existing_count = db.query(Advisor).count()
    if existing_count >= 50:
        return 0

    profiles = []

    for i in range(10):
        profiles.append({"type": "clean", "efm": False})
    for i in range(8):
        profiles.append({"type": "lender_medium", "efm": False})
    for i in range(5):
        profiles.append({"type": "lender_high", "efm": False})
    for i in range(5):
        profiles.append({"type": "provider_concentration", "efm": False})
    for i in range(5):
        profiles.append({"type": "poor_file_reviews", "efm": False})
    for i in range(4):
        profiles.append({"type": "deficiency_combo", "efm": False})
    for i in range(4):
        profiles.append({"type": "efm_concern", "efm": True})
    for i in range(4):
        profiles.append({"type": "multi_flag", "efm": random.choice([True, False])})
    for i in range(5):
        profiles.append({"type": "medium_mixed", "efm": False})

    random.shuffle(profiles)

    used_names = set()
    count = 0

    for idx, profile in enumerate(profiles):
        while True:
            fname = random.choice(FIRST_NAMES)
            lname = random.choice(LAST_NAMES)
            name = f"{fname} {lname}"
            if name not in used_names:
                used_names.add(name)
                break

        advisor_ref = f"ADV{10000 + idx:04d}"
        firm = random.choice(FIRMS)
        firm_ref = f"FIRM{random.randint(100, 999)}"

        ptype = profile["type"]
        efm = profile["efm"]

        high_lender = ptype in ("lender_medium", "lender_high", "deficiency_combo", "multi_flag")
        very_high_lender = ptype == "lender_high"
        high_provider = ptype in ("provider_concentration", "multi_flag")
        high_commission = ptype in ("efm_concern", "multi_flag") and efm
        poor_reviews = ptype in ("poor_file_reviews", "multi_flag")
        with_deficiencies = ptype in ("deficiency_combo", "multi_flag")

        advisor = Advisor(
            advisor_ref=advisor_ref,
            full_name=name,
            firm_name=firm,
            firm_ref=firm_ref,
            status="active",
            joined_date=datetime.utcnow() - timedelta(days=random.randint(365, 2920)),
            mortgage_lender_spread=_make_lender_spread(high_concentration=high_lender or very_high_lender),
            protection_provider_spread=_make_provider_spread(
                high_concentration=high_provider, high_commission=high_commission
            ),
            file_review_results=_make_file_reviews(poor_quality=poor_reviews),
            file_review_deficiencies=_make_deficiencies(with_concerning=with_deficiencies),
            enhanced_financial_monitoring=efm,
            current_risk_grade="low",
            current_risk_score=0.0,
        )
        db.add(advisor)
        count += 1

    db.commit()
    return count


def seed_risk_rules(db: Session):
    existing = db.query(RiskRule).count()
    if existing > 0:
        return

    rules = [
        RiskRule(
            name="Mortgage Lender Concentration — Medium",
            description="Advisor placing 50–70% of mortgages with a single lender",
            dataset="mortgage_lender_spread",
            condition_type="max_concentration_gt",
            threshold_value=50.0,
            threshold_unit="percent",
            risk_grade="medium",
            risk_weight=1.0,
            is_active=True,
            requires_edd=False,
            ai_prompt_hint="Focus on whether the concentration is justified by lender criteria or product fit.",
        ),
        RiskRule(
            name="Mortgage Lender Concentration — High",
            description="Advisor placing over 70% of mortgages with a single lender",
            dataset="mortgage_lender_spread",
            condition_type="max_concentration_gt",
            threshold_value=70.0,
            threshold_unit="percent",
            risk_grade="high",
            risk_weight=1.5,
            is_active=True,
            requires_edd=True,
            ai_prompt_hint="Evaluate whether cases show adequate lender market review and suitability justification.",
        ),
        RiskRule(
            name="Protection Provider Concentration — Medium",
            description="Advisor placing 55–70% of protection with a single provider",
            dataset="protection_provider_spread",
            condition_type="max_concentration_gt",
            threshold_value=55.0,
            threshold_unit="percent",
            risk_grade="medium",
            risk_weight=1.0,
            is_active=True,
            requires_edd=False,
            ai_prompt_hint="Consider whether provider preference is driven by commission rates.",
        ),
        RiskRule(
            name="Protection Provider Concentration — High",
            description="Advisor placing over 70% of protection with a single provider",
            dataset="protection_provider_spread",
            condition_type="max_concentration_gt",
            threshold_value=70.0,
            threshold_unit="percent",
            risk_grade="high",
            risk_weight=1.5,
            is_active=True,
            requires_edd=True,
            ai_prompt_hint="Assess if there is evidence of inadequate market research or commission bias.",
        ),
        RiskRule(
            name="File Review Failure Rate — Medium",
            description="12-month rolling file review failure rate exceeds 25%",
            dataset="file_review_results",
            condition_type="poor_review_rate_gt",
            threshold_value=25.0,
            threshold_unit="percent",
            risk_grade="medium",
            risk_weight=1.2,
            is_active=True,
            requires_edd=False,
            ai_prompt_hint="Identify whether failures are systematic or isolated to specific case types.",
        ),
        RiskRule(
            name="File Review Failure Rate — High",
            description="12-month rolling file review failure rate exceeds 45%",
            dataset="file_review_results",
            condition_type="poor_review_rate_gt",
            threshold_value=45.0,
            threshold_unit="percent",
            risk_grade="high",
            risk_weight=1.8,
            is_active=True,
            requires_edd=True,
            ai_prompt_hint="Evaluate competency concerns and whether remedial training has been provided.",
        ),
        RiskRule(
            name="Deficiency Codes with Lender Concentration",
            description="Specific file deficiency codes present alongside high lender concentration (>40%)",
            dataset="file_review_deficiencies",
            condition_type="deficiency_with_concentration",
            threshold_value=40.0,
            threshold_unit="percent",
            risk_grade="high",
            risk_weight=1.8,
            is_active=True,
            requires_edd=True,
            ai_prompt_hint="Assess whether deficiencies correlate with the concentrated lender's case types.",
        ),
        RiskRule(
            name="EFM Flag with High-Commission Provider",
            description="Active EFM flag AND significant placement with high-commission protection providers",
            dataset="enhanced_financial_monitoring",
            condition_type="efm_with_high_commission",
            threshold_value=20.0,
            threshold_unit="percent",
            risk_grade="critical",
            risk_weight=2.5,
            is_active=True,
            requires_edd=True,
            ai_prompt_hint="This is a critical customer outcome and potential conflicts of interest concern.",
        ),
    ]

    for rule in rules:
        db.add(rule)
    db.commit()


def seed_users(db: Session):
    existing = db.query(User).count()
    if existing > 0:
        return

    users = [
        User(
            email="admin@supervision-brain.local",
            full_name="System Administrator",
            hashed_password=hash_password("Admin@1234!"),
            is_admin=True,
            is_active=True,
            receive_alerts=True,
        ),
        User(
            email="compliance@supervision-brain.local",
            full_name="Compliance Officer",
            hashed_password=hash_password("Comply@1234!"),
            is_admin=False,
            is_active=True,
            receive_alerts=True,
        ),
        User(
            email="supervisor@supervision-brain.local",
            full_name="Supervision Manager",
            hashed_password=hash_password("Super@1234!"),
            is_admin=False,
            is_active=True,
            receive_alerts=True,
        ),
    ]

    for u in users:
        db.add(u)
    db.commit()


def seed_system_config(db: Session):
    existing = db.query(SystemConfig).count()
    if existing > 0:
        return

    configs = [
        SystemConfig(key="analysis_schedule_enabled", value="false",
                     description="Enable/disable automated daily analysis"),
        SystemConfig(key="analysis_schedule_hour", value="2",
                     description="Hour of day to run automated analysis (0-23)"),
        SystemConfig(key="analysis_schedule_minute", value="0",
                     description="Minute to run automated analysis"),
        SystemConfig(key="alert_threshold", value="high",
                     description="Minimum risk grade to trigger email alerts"),
        SystemConfig(key="max_lender_concentration_display", value="70",
                     description="Threshold % for highlighting lender concentration in dashboard"),
    ]
    for c in configs:
        db.add(c)
    db.commit()
