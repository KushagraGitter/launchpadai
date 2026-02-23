"""WebSocket endpoint for real-time agent progress streaming via Redis pub/sub."""

import asyncio
import json
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import async_session
from app.core.security import decode_token
from app.models.phase import Phase
from app.models.project import Project

router = APIRouter()


async def _redis_subscribe(channel: str):
    """Async generator that yields messages from a Redis pub/sub channel."""
    import redis.asyncio as aioredis

    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    try:
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg["type"] == "message":
                yield msg["data"]
            else:
                await asyncio.sleep(0.1)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await r.close()


@router.websocket("/ws/projects/{project_id}/agents")
async def agent_progress_ws(websocket: WebSocket, project_id: str):
    """Stream agent execution progress for a project via WebSocket.

    Auth: client sends {"token": "..."} as the first message.
    Events are streamed in real-time via Redis pub/sub, with periodic
    DB snapshots as fallback.
    """
    await websocket.accept()

    try:
        auth_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth_data = json.loads(auth_msg)
        token = auth_data.get("token")

        if not token:
            await websocket.send_json({"error": "Authentication required"})
            await websocket.close(code=4001)
            return

        payload = decode_token(token)
        if payload is None or payload.get("type") != "access":
            await websocket.send_json({"error": "Invalid or expired token"})
            await websocket.close(code=4001)
            return

        user_id = uuid.UUID(payload["sub"])
        proj_id = uuid.UUID(project_id)

        async with async_session() as db:
            result = await db.execute(
                select(Project).where(Project.id == proj_id, Project.user_id == user_id)
            )
            if result.scalar_one_or_none() is None:
                await websocket.send_json({"error": "Project not found"})
                await websocket.close(code=4004)
                return

        await websocket.send_json({"type": "connected", "project_id": project_id})

        channel = f"agent_progress:{project_id}"

        async def stream_redis_events():
            """Forward Redis pub/sub messages to the WebSocket client."""
            try:
                async for raw in _redis_subscribe(channel):
                    try:
                        event = json.loads(raw)
                        await websocket.send_json(event)
                    except (json.JSONDecodeError, RuntimeError):
                        break
            except Exception:
                pass

        async def periodic_snapshot():
            """Send full phase/agent status every 8 seconds as fallback."""
            while True:
                await asyncio.sleep(8)
                try:
                    async with async_session() as db:
                        result = await db.execute(
                            select(Phase)
                            .where(Phase.project_id == proj_id)
                            .options(selectinload(Phase.agent_runs))
                            .order_by(Phase.created_at.desc())
                        )
                        phases = result.scalars().all()

                        progress_data = []
                        for phase in phases:
                            runs = [
                                {
                                    "agent": r.agent_name,
                                    "status": r.status,
                                    "summary": r.output_summary,
                                }
                                for r in (phase.agent_runs or [])
                            ]
                            progress_data.append({
                                "phase": phase.phase_type.value,
                                "status": phase.status,
                                "agents": runs,
                            })

                        await websocket.send_json({
                            "type": "snapshot",
                            "phases": progress_data,
                        })
                except RuntimeError:
                    break
                except Exception:
                    pass

        async def receive_pings():
            """Keep the connection alive and detect disconnect."""
            try:
                while True:
                    await websocket.receive_text()
            except WebSocketDisconnect:
                pass

        redis_task = asyncio.create_task(stream_redis_events())
        snapshot_task = asyncio.create_task(periodic_snapshot())
        ping_task = asyncio.create_task(receive_pings())

        done, pending = await asyncio.wait(
            [redis_task, snapshot_task, ping_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=4001)
    except Exception:
        try:
            await websocket.close(code=1011)
        except RuntimeError:
            pass
