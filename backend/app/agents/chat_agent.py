# Stateless — the frontend owns the conversation transcript and resends recent history.
import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.services.ai_client import get_ai_client
from app.services.chat_context import build_chat_context

logger = logging.getLogger(__name__)

MAX_HISTORY_TURNS = 6


class ChatAgent:
    def __init__(self, db: Session):
        self.db = db
        self.ai = get_ai_client()

    def answer(self, message: str, history: Optional[List[Dict[str, str]]] = None) -> str:
        if not self.ai.available:
            return "AI assistant is not currently available. Configure an AI provider (AI_PROVIDER in .env) to enable chat."

        context = build_chat_context(self.db, message)
        history_text = self._format_history(history)

        prompt = f"""You are a compliance data assistant for Supervision Brain, a network risk analysis
platform. Answer the user's question using ONLY the data provided below. If the data doesn't contain
the answer, say so explicitly rather than guessing. Be concise and use compliance/supervision
terminology where appropriate.

{context}
{history_text}
User question: {message}

Answer:"""

        reply = self.ai.generate(prompt, max_tokens=800)
        return reply or "The AI did not return a response — please try again."

    def _format_history(self, history: Optional[List[Dict[str, str]]]) -> str:
        if not history:
            return ""
        trimmed = history[-MAX_HISTORY_TURNS:]
        lines = ["\nConversation so far:"]
        for turn in trimmed:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            lines.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")
        return "\n".join(lines)
