"""Background worker for executing phase crews asynchronously."""

import asyncio
import json
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor

import redis

from app.core.config import settings

QUEUE_NAME = "ideaos:phase_jobs"


def get_redis_client():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


async def process_job(phase_id_str: str) -> None:
    """Process a single phase execution job with a fresh DB session."""
    from app.core.database import create_async_session
    from app.services.phase_runner import run_phase

    phase_id = uuid.UUID(phase_id_str)
    session_factory = create_async_session()
    async with session_factory() as db:
        try:
            await run_phase(db, phase_id)
            await db.commit()
        except Exception as e:
            await db.rollback()
            print(f"Phase {phase_id} failed: {e}", file=sys.stderr)


def run_worker() -> None:
    """Run the background worker loop, polling Redis for jobs."""
    r = get_redis_client()
    print(f"LaunchPadAI Worker started. Listening on queue: {QUEUE_NAME}")

    while True:
        try:
            result = r.brpop(QUEUE_NAME, timeout=5)
            if result is None:
                continue

            _, job_data = result
            job = json.loads(job_data)
            phase_id = job.get("phase_id")
            if phase_id:
                print(f"Processing phase: {phase_id}")
                asyncio.run(process_job(phase_id))
                print(f"Completed phase: {phase_id}")

        except KeyboardInterrupt:
            print("Worker shutting down.")
            break
        except Exception as e:
            print(f"Worker error: {e}", file=sys.stderr)
            import time
            time.sleep(5)


def dispatch_phase_job(phase_id: uuid.UUID) -> None:
    """Dispatch a phase execution job to the Redis queue."""
    r = get_redis_client()
    job = json.dumps({"phase_id": str(phase_id)})
    r.lpush(QUEUE_NAME, job)


if __name__ == "__main__":
    run_worker()
