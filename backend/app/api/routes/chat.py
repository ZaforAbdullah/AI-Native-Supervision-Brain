from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from app.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User
from app.agents.chat_agent import ChatAgent

router = APIRouter()


class ChatMessageIn(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = None


class ChatMessageOut(BaseModel):
    reply: str


@router.post("/", response_model=ChatMessageOut)
def chat(
    body: ChatMessageIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    agent = ChatAgent(db)
    return {"reply": agent.answer(body.message, body.history)}
