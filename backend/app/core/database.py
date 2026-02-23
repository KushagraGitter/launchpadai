from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_connect_args = {}
if "supabase" in settings.DATABASE_URL:
    _connect_args = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}

engine = create_async_engine(
    settings.DATABASE_URL,
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
        settings.DATABASE_URL,
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
