from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import AnalysisRun
from app.schemas.schemas import AnalysisRunOut, TriggerAnalysisRequest
from app.api.deps import get_current_active_user, require_admin
from app.models.models import User
from app.agents.orchestrator import SupervisionOrchestrator

router = APIRouter()


def run_analysis_task(db_factory, advisor_ids, trigger, user_id):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        orchestrator = SupervisionOrchestrator(db)
        orchestrator.run_analysis(advisor_ids=advisor_ids, trigger=trigger, triggered_by=user_id)
    finally:
        db.close()


@router.post("/trigger", response_model=AnalysisRunOut)
def trigger_analysis(
    request: TriggerAnalysisRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    background_tasks.add_task(
        run_analysis_task,
        None,
        request.advisor_ids,
        request.trigger,
        current_user.id,
    )
    import uuid
    from datetime import datetime
    from app.models.models import AnalysisStatus
    placeholder = AnalysisRun(
        run_ref=f"NRA-{datetime.utcnow().strftime('%Y%m%d-%H%M')}-{str(uuid.uuid4())[:4].upper()}",
        status=AnalysisStatus.PENDING,
        trigger=request.trigger,
        triggered_by=current_user.id,
    )
    db.add(placeholder)
    db.commit()
    db.refresh(placeholder)
    return placeholder


@router.get("/", response_model=List[AnalysisRunOut])
def list_runs(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return (
        db.query(AnalysisRun)
        .order_by(AnalysisRun.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{run_id}", response_model=AnalysisRunOut)
def get_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    return run
