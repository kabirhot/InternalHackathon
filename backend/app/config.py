"""All settings come from environment variables. Nothing secret is ever hard-coded here."""
import os
from functools import lru_cache
from pathlib import Path


def _list(name: str) -> list[str]:
    return [x.strip() for x in os.getenv(name, "").split(",") if x.strip()]


class Settings:
    def __init__(self) -> None:
        # Where to read data from. Without Supabase settings the API serves the frontend's JSON files,
        # so it works on day one and in tests.
        self.supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")  # server only, never sent to browsers
        self.supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        default_data = Path(__file__).resolve().parents[2] / "frontend" / "src" / "mock"
        self.data_dir = Path(os.getenv("DATA_DIR", str(default_data)))

        # Which websites may call this API (the Vercel site, plus local dev).
        self.cors_origins = _list("CORS_ORIGINS") or [
            "https://civic-navigator-seven.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:4173",
        ]

        # Admins: only these emails may use /admin routes, after signing in with Supabase Auth.
        self.admin_emails = [e.lower() for e in _list("ADMIN_EMAILS")]

        # ElevenLabs read-aloud.
        self.elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "")
        self.elevenlabs_model = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
        self.elevenlabs_voice = os.getenv("ELEVENLABS_VOICE_ID", "")

        # LLM used to read official pages and to understand free-text searches.
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.llm_model = os.getenv("LLM_MODEL", "claude-haiku-4-5-20251001")

        # Only these domains may be fetched by the extraction pipeline (stops it being used to reach internal hosts).
        self.source_domains = _list("SOURCE_DOMAINS") or ["gov.in", "nic.in"]

        # Simple per-IP limits (requests per minute).
        self.rate_public = int(os.getenv("RATE_PUBLIC_PER_MIN", "120"))
        self.rate_tts = int(os.getenv("RATE_TTS_PER_MIN", "10"))
        self.rate_query = int(os.getenv("RATE_QUERY_PER_MIN", "30"))

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)


@lru_cache
def settings() -> Settings:
    return Settings()
