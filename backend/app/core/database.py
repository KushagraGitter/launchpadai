import ssl
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_db_url = settings.DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")

_connect_args: dict = {}
if "supabase" in settings.DATABASE_URL:
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_cache_size"] = 0
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _connect_args["ssl"] = _ssl_ctx

    # asyncpg/SQLAlchemy mis-parse usernames containing dots (e.g. postgres.project-ref).
    # Pass the full username via server_settings so asyncpg sends it correctly to the Supabase pooler.
    parsed = urlparse(_db_url)
    if parsed.username and "." in parsed.username:
        _connect_args["server_settings"] = {"user": parsed.username}

engine = create_async_engine(
    _db_url,
    echo=settings.APP_ENV == "development",
    pool_size=20,
    max_overflow=10,
    connect_args=_connect_args,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def create_async_session() -> async_sessionmaker[AsyncSession]:
    """Create a fresh engine and session factory (safe for new event loops)."""
    fresh_engine = create_async_engine(
        _db_url,
        echo=settings.APP_ENV == "development",
        pool_size=5,
        max_overflow=5,
        connect_args=_connect_args,
    )
    return async_sessionmaker(fresh_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
