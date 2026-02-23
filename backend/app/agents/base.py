"""Shared agent utilities, callback handler, and LLM configuration for all CrewAI crews."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

import redis

from crewai import LLM

from app.core.config import settings


def get_llm() -> LLM:
    return LLM(
        model=f"openai/{settings.OPENAI_MODEL}",
        api_key=settings.OPENAI_API_KEY,
        temperature=0.7,
    )


def _get_redis():
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


class PhaseCallbackHandler:
    """Publishes agent progress events to Redis pub/sub for real-time streaming."""

    def __init__(self, phase_id: uuid.UUID, project_id: uuid.UUID):
        self.phase_id = phase_id
        self.project_id = project_id
        self._redis = _get_redis()
        self._channel = f"agent_progress:{project_id}"

    def _publish(self, event: dict[str, Any]) -> None:
        event["phase_id"] = str(self.phase_id)
        event["project_id"] = str(self.project_id)
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        try:
            self._redis.publish(self._channel, json.dumps(event))
        except Exception:
            pass

    def on_phase_start(self, phase_type: str, agents: list[str]) -> None:
        self._publish({
            "type": "phase_start",
            "phase_type": phase_type,
            "agents": agents,
        })

    def on_agent_start(self, agent_name: str, task_description: str = "") -> None:
        self._publish({
            "type": "agent_start",
            "agent": agent_name,
            "task": task_description[:200],
        })

    def on_agent_thinking(self, agent_name: str, thought: str) -> None:
        self._publish({
            "type": "agent_thinking",
            "agent": agent_name,
            "thought": thought[:300],
        })

    def on_agent_complete(self, agent_name: str, output_summary: str) -> None:
        self._publish({
            "type": "agent_complete",
            "agent": agent_name,
            "summary": output_summary[:500],
        })

    def on_phase_complete(self, phase_type: str) -> None:
        self._publish({
            "type": "phase_complete",
            "phase_type": phase_type,
        })

    def on_phase_error(self, phase_type: str, error: str) -> None:
        self._publish({
            "type": "phase_error",
            "phase_type": phase_type,
            "error": error[:500],
        })


def build_context_string(project_data: dict[str, Any]) -> str:
    """Build a structured context string from project data for agent prompts."""
    parts = [
        f"Project: {project_data.get('name', 'Unnamed')}",
        f"Idea: {project_data.get('raw_idea', '')}",
    ]
    if project_data.get("domain"):
        parts.append(f"Domain: {project_data['domain']}")
    if project_data.get("target_audience"):
        parts.append(f"Target Audience: {project_data['target_audience']}")
    if project_data.get("rag_context"):
        parts.append(f"\n--- Prior Phase Context ---\n{project_data['rag_context']}")
    return "\n".join(parts)


def parse_agent_output(output: str) -> dict[str, Any]:
    """Attempt to parse structured JSON from agent output, fallback to raw text."""
    try:
        return json.loads(output)
    except (json.JSONDecodeError, TypeError):
        return {"raw_output": output}
