from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


class Settings:
    app_name: str = "AI Parallel Chat"
    db_path: Path = Path(os.getenv("PARALLEL_CHAT_DB", ROOT_DIR / "backend" / "app.db"))
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    context_char_budget: int = int(os.getenv("CONTEXT_CHAR_BUDGET", "32000"))


settings = Settings()

