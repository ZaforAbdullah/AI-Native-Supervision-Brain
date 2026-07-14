from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

    # AI provider: "lm_studio" (local) or "gemini" (production). Leave blank to disable AI.
    AI_PROVIDER: str = ""

    # LM Studio (local development)
    LM_STUDIO_BASE_URL: str = "http://localhost:1234/v1"
    LM_STUDIO_MODEL: str = "local-model"

    # Google Gemini (production)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"

    AI_RATE_LIMIT_PER_MINUTE: int = 10  # Gemini only — keeps under free-tier quota
    AI_REQUEST_TIMEOUT_SECONDS: int = 60

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@supervision-brain.local"

    ANALYSIS_SCHEDULE_HOUR: int = 2
    ANALYSIS_SCHEDULE_MINUTE: int = 0

    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
