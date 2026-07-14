from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.models import Advisor, Finding
from app.schemas.schemas import AdvisorOut, AdvisorDetail, AdvisorCreate, FindingOut
from app.api.deps import get_current_active_user
from app.models.models import User
from app.agents.pattern_agent import PatternDiscoveryAgent

router = APIRouter()


@router.get("/", response_model=List[AdvisorOut])
def list_advisors(
    skip: int = 0,
    limit: int = 100,
    risk_grade: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    q = db.query(Advisor)
    if risk_grade:
        q = q.filter(Advisor.current_risk_grade == risk_grade)
    if search:
        q = q.filter(
            Advisor.full_name.ilike(f"%{search}%") |
            Advisor.firm_name.ilike(f"%{search}%") |
            Advisor.advisor_ref.ilike(f"%{search}%")
        )
    return q.order_by(Advisor.current_risk_score.desc()).offset(skip).limit(limit).all()


@router.get("/{advisor_id}", response_model=AdvisorDetail)
def get_advisor(
    advisor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    advisor = db.query(Advisor).filter(Advisor.id == advisor_id).first()
    if not advisor:
        raise HTTPException(status_code=404, detail="Advisor not found")
    return advisor


@router.post("/", response_model=AdvisorOut)
def create_advisor(
    advisor_in: AdvisorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    existing = db.query(Advisor).filter(Advisor.advisor_ref == advisor_in.advisor_ref).first()
    if existing:
        raise HTTPException(status_code=400, detail="Advisor ref already exists")
    advisor = Advisor(**advisor_in.model_dump())
    db.add(advisor)
    db.commit()
    db.refresh(advisor)
    return advisor


@router.get("/{advisor_id}/findings")
def get_advisor_findings(
    advisor_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    advisor = db.query(Advisor).filter(Advisor.id == advisor_id).first()
    if not advisor:
        raise HTTPException(status_code=404, detail="Advisor not found")
    findings = (
        db.query(Finding)
        .filter(Finding.advisor_id == advisor_id)
        .order_by(Finding.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": f.id,
            "finding_type": f.finding_type,
            "risk_grade": f.risk_grade,
            "risk_score": f.risk_score,
            "title": f.title,
            "description": f.description,
            "evidence": f.evidence,
            "triggered_value": f.triggered_value,
            "threshold_value": f.threshold_value,
            "requires_edd": f.requires_edd,
            "edd_completed": f.edd_completed,
            "edd_notes": f.edd_notes,
            "ai_analysis": f.ai_analysis,
            "source": f.source,
            "created_at": f.created_at,
        }
        for f in findings
    ]


@router.post("/{advisor_id}/discover-patterns", response_model=List[FindingOut])
def discover_patterns(
    advisor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    advisor = db.query(Advisor).filter(Advisor.id == advisor_id).first()
    if not advisor:
        raise HTTPException(status_code=404, detail="Advisor not found")
    agent = PatternDiscoveryAgent(db)
    if not agent.ai.available:
        raise HTTPException(status_code=503, detail="AI provider not configured")
    return agent.discover_patterns(advisor)
