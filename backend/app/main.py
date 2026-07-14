from sqlalchemy import text
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base, get_db
from app.models import models  # noqa — ensures all models register
from app.config import settings
from app.api.routes import auth, advisors, analysis, reports, rules, dashboard, ingestion, chat
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from app.seed_data import seed_users, seed_risk_rules, seed_sample_advisors, seed_system_config
        seed_users(db)
        seed_risk_rules(db)
        seed_sample_advisors(db)
        seed_system_config(db)
        logger.info("Database seeded successfully")
    finally:
        db.close()

    from app.services.ai_client import get_ai_client
    ai = get_ai_client()
    if ai.available:
        logger.info(f"AI engine: {settings.AI_PROVIDER} (model active)")
    else:
        logger.info("AI engine: not configured — using rule-based analysis only (set AI_PROVIDER in .env)")

    yield
    logger.info("Supervision Brain shutting down")


app = FastAPI(
    title="AI Supervision Brain",
    description="Multi-agent AI platform for automated advisor supervision and network risk analysis",
    version="1.0.0-poc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(advisors.router, prefix="/api/advisors", tags=["Advisors"])
app.include_router(rules.router, prefix="/api/rules", tags=["Risk Rules"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Data Ingestion"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/health")
@app.head("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "service": "AI Supervision Brain POC", "version": "1.0.0-poc"}
