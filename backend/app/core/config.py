import json
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine base paths for locating .env reliably
# Path to backend root (e.g. backend/)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
# Path to project root (e.g. saylani-new/)
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    PROJECT_NAME: str = "HCM Lite"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT_NAME: str = "gpt-5.4-mini"
    AZURE_OPENAI_API_VERSION: str = "2025-01-01-preview"

    # Azure Communication Services (Email)
    AZURE_COMMUNICATION_CONNECTION_STRING: str = ""
    AZURE_EMAIL_SENDER: str = "noreply@uirefine.app"

    # CORS Origins
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Security & JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if item]
                except Exception:
                    pass
            return [item.strip() for item in v_stripped.split(",") if item.strip()]
        elif isinstance(v, list):
            return [str(item).strip() for item in v if item]
        return ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=[
            str(BACKEND_DIR / ".env"),
            str(PROJECT_ROOT / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
