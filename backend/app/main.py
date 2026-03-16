from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, chat, projects, phases, websocket, export, subscriptions, webhooks
from app.core.config import settings
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.agents.base import configure_langsmith
        configure_langsmith()
    except ImportError:
        pass  # crewai not installed — v1 agents unavailable, v2 worker handles phases
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-native SaaS platform for idea-to-production workflows",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(phases.router, prefix="/api/projects", tags=["phases"])
app.include_router(chat.router, prefix="/api/projects", tags=["chat"])
app.include_router(websocket.router, prefix="/api", tags=["websocket"])
app.include_router(export.router, prefix="/api/projects", tags=["export"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "env": settings.APP_ENV}


@app.get("/api/health/ready")
async def readiness_check():
    """Deep health check that verifies database and Redis connectivity."""
    import redis.asyncio as aioredis
    from sqlalchemy import text

    checks: dict = {"app": "ok"}
    healthy = True

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = str(exc)
        healthy = False

    try:
        r = aioredis.from_url(settings.REDIS_URL)
        await r.ping()
        await r.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = str(exc)
        healthy = False

    status_code = 200 if healthy else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"status": "healthy" if healthy else "degraded", "checks": checks},
        status_code=status_code,
    )
