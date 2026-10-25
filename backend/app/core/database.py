import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Normalize database URL for psycopg2 if configured as postgresql://
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+psycopg2://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Synchronous SQLAlchemy 2.0 engine
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Synchronous session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

# Base class for declarative models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a database session and closing it after request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Auto-create all registered SQLAlchemy tables on startup via Base.metadata.create_all.
    Also executes safe schema upgrades for new columns.
    """
    try:
        # Import models so they are registered on Base.metadata before creating tables
        import app.models.models  # noqa: F401
        from sqlalchemy import text

        Base.metadata.create_all(bind=engine)

        # Run idempotent column migrations for existing databases
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS admin_allowed_ips JSON DEFAULT '[]'::json;
                    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS hr_allowed_ips JSON DEFAULT '[]'::json;
                    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS employee_allowed_ips JSON DEFAULT '[]'::json;
                    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS ip_restrictions_enabled BOOLEAN DEFAULT FALSE;
                    """
                )
            )

        logger.info("Database tables and schema upgrades verified and initialized successfully.")
    except Exception as e:
        logger.error("Failed to initialize database tables: %s", e)
        raise
