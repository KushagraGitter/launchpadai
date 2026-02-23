from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, chat, projects, phases, websocket, export, subscriptions, webhooks
from app.core.config import settings
from app.core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
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
    return {"status": "healthy", "app": settings.APP_NAME}
