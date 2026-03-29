"""Background worker job dispatcher.

All phase execution is handled by the TypeScript/LangGraph agent-worker (v2).
This module provides dispatch_phase_job() to push jobs onto the Redis queue,
and a legacy run_worker() entry point (no longer used in production).
"""

import json
import uuid

import redis

from app.core.config import settings

QUEUE_NAME = "ideaos:phase_jobs"
QUEUE_NAME_V2 = "ideaos:phase_jobs_v2"


def get_redis_client():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def dispatch_phase_job(phase_id: uuid.UUID, use_v2: bool = True, agent_names: list[str] | None = None) -> None:
    """Dispatch a phase execution job to the v2 agent-worker queue.

    The use_v2 flag is kept for backward compatibility but defaults to True.
    All new projects use the TypeScript/LangGraph agent-worker exclusively.
    """
    r = get_redis_client()
    payload: dict = {"phase_id": str(phase_id)}
    if agent_names:
        payload["agent_names"] = agent_names
    job = json.dumps(payload)
    queue = QUEUE_NAME_V2 if use_v2 else QUEUE_NAME
    r.lpush(queue, job)
