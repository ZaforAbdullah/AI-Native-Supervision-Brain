from __future__ import annotations
import json
import logging
import re
import threading
import time
from typing import Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


def parse_json_response(raw: Optional[str]) -> Any:
    """Best-effort JSON parse of an LLM response, stripping markdown code fences if present."""
    if not raw:
        return None
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def _is_rate_limit_error(e: Exception) -> bool:
    text = str(e).lower()
    return "429" in text or "quota" in text or "rate limit" in text or "resourceexhausted" in type(e).__name__.lower()


def _extract_retry_delay(e: Exception, default: float = 20.0) -> float:
    match = re.search(r"retry in (\d+(?:\.\d+)?)s", str(e), re.IGNORECASE)
    return float(match.group(1)) if match else default


class _RateLimiter:
    # Blocks until a slot opens rather than rejecting — the request should eventually go through.
    def __init__(self, max_per_minute: int):
        self.max_per_minute = max_per_minute
        self._timestamps: list[float] = []
        self._lock = threading.Lock()

    def wait_for_slot(self) -> None:
        if self.max_per_minute <= 0:
            return
        with self._lock:
            now = time.monotonic()
            self._timestamps = [t for t in self._timestamps if t > now - 60]
            if len(self._timestamps) >= self.max_per_minute:
                sleep_for = 60 - (now - self._timestamps[0])
                if sleep_for > 0:
                    time.sleep(sleep_for)
                now = time.monotonic()
                self._timestamps = [t for t in self._timestamps if t > now - 60]
            self._timestamps.append(time.monotonic())


def _build_lm_studio_client():
    from openai import OpenAI
    return OpenAI(
        base_url=settings.LM_STUDIO_BASE_URL,
        api_key="lm-studio",
        timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
    )


def _build_gemini_client():
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(settings.GEMINI_MODEL)


class AIClient:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self._client = None
        self._rate_limiter: Optional[_RateLimiter] = None

        if self.provider == "lm_studio":
            if not settings.LM_STUDIO_BASE_URL:
                logger.warning("AI_PROVIDER=lm_studio but LM_STUDIO_BASE_URL not set — AI disabled")
                self.provider = None
            else:
                try:
                    self._client = _build_lm_studio_client()
                    logger.info(f"AI: LM Studio @ {settings.LM_STUDIO_BASE_URL} model={settings.LM_STUDIO_MODEL}")
                except Exception as e:
                    logger.warning(f"Failed to init LM Studio client: {e}")
                    self.provider = None

        elif self.provider == "gemini":
            if not settings.GEMINI_API_KEY:
                logger.warning("AI_PROVIDER=gemini but GEMINI_API_KEY not set — AI disabled")
                self.provider = None
            else:
                try:
                    self._client = _build_gemini_client()
                    self._rate_limiter = _RateLimiter(settings.AI_RATE_LIMIT_PER_MINUTE)
                    logger.info(
                        f"AI: Google Gemini model={settings.GEMINI_MODEL} "
                        f"(self-throttled to {settings.AI_RATE_LIMIT_PER_MINUTE}/min)"
                    )
                except Exception as e:
                    logger.warning(f"Failed to init Gemini client: {e}")
                    self.provider = None

        else:
            if self.provider:
                logger.warning(f"Unknown AI_PROVIDER='{self.provider}' — AI disabled")
            self.provider = None

    @property
    def available(self) -> bool:
        return self.provider is not None and self._client is not None

    def generate(self, prompt: str, max_tokens: int = 1500, json_mode: bool = False) -> Optional[str]:
        if not self.available:
            return None
        if self._rate_limiter:
            self._rate_limiter.wait_for_slot()
        try:
            return self._generate_once(prompt, max_tokens, json_mode)
        except Exception as e:
            if _is_rate_limit_error(e):
                delay = _extract_retry_delay(e)
                logger.warning(f"AI rate limited ({self.provider}) — retrying in {delay:.0f}s")
                time.sleep(delay)
                try:
                    return self._generate_once(prompt, max_tokens, json_mode)
                except Exception as e2:
                    logger.warning(f"AI generation failed after retry ({self.provider}): {e2}")
                    return None
            logger.warning(f"AI generation failed ({self.provider}): {e}")
            return None

    def _generate_once(self, prompt: str, max_tokens: int, json_mode: bool) -> str:
        if self.provider == "lm_studio":
            return self._lm_studio_generate(prompt, max_tokens, json_mode)
        return self._gemini_generate(prompt, max_tokens, json_mode)

    def _lm_studio_generate(self, prompt: str, max_tokens: int, json_mode: bool = False) -> str:
        kwargs = dict(
            model=settings.LM_STUDIO_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = self._client.chat.completions.create(**kwargs)
        except Exception:
            # Some local models reject response_format outright — retry without it.
            kwargs.pop("response_format", None)
            response = self._client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def _gemini_generate(self, prompt: str, max_tokens: int, json_mode: bool = False) -> str:
        import google.generativeai as genai
        config_kwargs = {"max_output_tokens": max_tokens, "temperature": 0.3}
        if json_mode:
            config_kwargs["response_mime_type"] = "application/json"
        response = self._client.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(**config_kwargs),
            request_options={"timeout": settings.AI_REQUEST_TIMEOUT_SECONDS},
        )
        return response.text


_client_instance: Optional[AIClient] = None


def get_ai_client() -> AIClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
