"""Background worker for executing phase crews asynchronously."""

import asyncio
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor

import redis

from app.core.config import settings

QUEUE_NAME = "ideaos:phase_jobs"
QUEUE_NAME_V2 = "ideaos:phase_jobs_v2"


def get_redis_client():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def process_job(phase_id_str: str, agent_names: list[str] | None = None) -> None:
    """Process a single phase execution job with a fresh DB session."""
    from app.core.database import create_async_session
    from app.services.phase_runner import run_phase, run_phase_targeted

    phase_id = uuid.UUID(phase_id_str)
    session_factory = create_async_session()
    async with session_factory() as db:
        try:
            if agent_names:
                await run_phase_targeted(db, phase_id, agent_names)
            else:
                await run_phase(db, phase_id)
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Phase {phase_id} failed: {e}", file=sys.stderr)


def run_worker() -> None:
    """Run the background worker loop, polling Redis for jobs."""
    from app.agents.base import configure_langsmith
    configure_langsmith()

    r = get_redis_client()
    print(f"LaunchPadAI Worker started. Listening on queue: {QUEUE_NAME}", flush=True)

    while True:
        try:
            result = r.brpop(QUEUE_NAME, timeout=5)
            if result is None:
                continue

            _, job_data = result
            job = json.loads(job_data)
            phase_id = job.get("phase_id")
            agent_names = job.get("agent_names")  # optional: targeted re-run
            if phase_id:
                print(f"Processing phase: {phase_id} agents={agent_names}", flush=True)
                asyncio.run(process_job(phase_id, agent_names))
                print(f"Completed phase: {phase_id}", flush=True)

        except KeyboardInterrupt:
            print("Worker shutting down.", flush=True)
            break
        except Exception as e:
            print(f"Worker error: {e}", file=sys.stderr, flush=True)
            import time
            time.sleep(5)


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


if __name__ == "__main__":
    run_worker()
