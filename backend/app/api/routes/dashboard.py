from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta
from app.database import get_db
from app.models.models import Advisor, AnalysisRun, SupervisionReport, Finding
from app.schemas.schemas import DashboardStats
from app.api.deps import get_current_active_user
from app.models.models import User

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    total_advisors = db.query(Advisor).count()
    active_advisors = db.query(Advisor).filter(Advisor.status == "active").count()
    critical_count = db.query(Advisor).filter(Advisor.current_risk_grade == "critical").count()
    high_count = db.query(Advisor).filter(Advisor.current_risk_grade == "high").count()
    medium_count = db.query(Advisor).filter(Advisor.current_risk_grade == "medium").count()
    low_count = db.query(Advisor).filter(Advisor.current_risk_grade == "low").count()
    efm_count = db.query(Advisor).filter(Advisor.enhanced_financial_monitoring == True).count()

    last_run = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.status == "completed")
        .order_by(AnalysisRun.completed_at.desc())
        .first()
    )
    total_reports = db.query(SupervisionReport).count()

    runs = (
        db.query(AnalysisRun)
        .filter(AnalysisRun.status == "completed")
        .order_by(AnalysisRun.created_at.asc())
        .limit(12)
        .all()
    )
    risk_trend = []
    for run in runs:
        risk_trend.append({
            "date": run.completed_at.strftime("%d %b") if run.completed_at else "",
            "high": run.high_risk_count,
            "critical": run.critical_risk_count,
            "total": run.risks_identified,
        })

    top_risk_advisors = (
        db.query(Advisor)
        .filter(Advisor.current_risk_grade.in_(["critical", "high"]))
        .order_by(Advisor.current_risk_score.desc())
        .limit(5)
        .all()
    )
    top_risk_list = [
        {
            "id": a.id,
            "advisor_ref": a.advisor_ref,
            "full_name": a.full_name,
            "firm_name": a.firm_name,
            "risk_grade": a.current_risk_grade,
            "risk_score": a.current_risk_score,
        }
        for a in top_risk_advisors
    ]

    lender_alerts = db.query(Finding).filter(
        Finding.finding_type == "lender_concentration"
    ).count()
    provider_alerts = db.query(Finding).filter(
        Finding.finding_type == "provider_concentration"
    ).count()

    return DashboardStats(
        total_advisors=total_advisors,
        active_advisors=active_advisors,
        critical_risk_count=critical_count,
        high_risk_count=high_count,
        medium_risk_count=medium_count,
        low_risk_count=low_count,
        last_analysis_run=last_run.completed_at if last_run else None,
        total_reports=total_reports,
        risk_trend=risk_trend,
        top_risk_advisors=top_risk_list,
        lender_concentration_alerts=lender_alerts,
        provider_concentration_alerts=provider_alerts,
        efm_flags_active=efm_count,
    )
