from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import RiskRule
from app.schemas.schemas import RiskRuleOut, RiskRuleCreate, RiskRuleUpdate, RiskRuleBase
from app.api.deps import get_current_active_user, require_admin
from app.models.models import User
from app.agents.rule_author_agent import RuleAuthorAgent

router = APIRouter()


class DraftRuleRequest(BaseModel):
    description: str


@router.post("/draft", response_model=RiskRuleBase)
def draft_rule(
    body: DraftRuleRequest,
    _: User = Depends(require_admin),
):
    agent = RuleAuthorAgent()
    try:
        return agent.draft_rule(body.description)
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/", response_model=List[RiskRuleOut])
def list_rules(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    return db.query(RiskRule).order_by(RiskRule.dataset, RiskRule.name).all()


@router.get("/{rule_id}", response_model=RiskRuleOut)
def get_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_active_user)):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


@router.post("/", response_model=RiskRuleOut)
def create_rule(
    rule_in: RiskRuleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = RiskRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=RiskRuleOut)
def update_rule(
    rule_id: int,
    rule_update: RiskRuleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in rule_update.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}


@router.patch("/{rule_id}/toggle")
def toggle_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rule = db.query(RiskRule).filter(RiskRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.is_active = not rule.is_active
    db.commit()
    return {"id": rule_id, "is_active": rule.is_active}
