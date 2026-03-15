"""Shared agent utilities, callback handler, and LLM configuration for all CrewAI crews."""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import redis
from crewai import LLM
from crewai.tools.base_tool import BaseTool as CrewBaseTool
from pydantic import BaseModel as PydanticBaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

_langsmith_configured = False


def configure_langsmith() -> None:
    """Set LangSmith env vars so LangChain (used by CrewAI) auto-traces all LLM calls.

    Safe to call multiple times; only configures once. When LANGSMITH_API_KEY is
    not set, tracing is silently disabled.
    """
    global _langsmith_configured
    if _langsmith_configured:
        return
    _langsmith_configured = True

    if not settings.LANGSMITH_API_KEY:
        logger.info("LANGSMITH_API_KEY not set — LangSmith tracing disabled")
        return

    os.environ["LANGCHAIN_TRACING_V2"] = "true" if settings.LANGSMITH_TRACING else "false"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
    os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGSMITH_ENDPOINT

    logger.info(
        "LangSmith tracing %s — project: %s",
        "enabled" if settings.LANGSMITH_TRACING else "disabled (set LANGSMITH_TRACING=true)",
        settings.LANGSMITH_PROJECT,
    )


def get_llm() -> LLM:
    return LLM(
        model=f"openai/{settings.OPENAI_MODEL}",
        api_key=settings.OPENAI_API_KEY,
        temperature=0.7,
    )


# ---------------------------------------------------------------------------
# Tavily web-search tool for CrewAI agents
# ---------------------------------------------------------------------------

class _TavilySearchSchema(PydanticBaseModel):
    query: str = Field(..., description="The search query to look up on the web")


class TavilySearchTool(CrewBaseTool):
    """CrewAI tool that searches the web using the Tavily API."""

    name: str = "Web Search"
    description: str = (
        "Search the web for current, real-time information. "
        "Returns a synthesized answer with source URLs. "
        "Use this to find market data, competitor info, pricing, trends, and statistics."
    )
    args_schema: type[PydanticBaseModel] = _TavilySearchSchema

    search_depth: str = "basic"
    topic: str = "general"
    max_results: int = 5

    def _run(self, query: str) -> str:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(
            query=query,
            search_depth=self.search_depth,
            topic=self.topic,
            max_results=self.max_results,
            include_answer=True,
        )

        parts: list[str] = []
        if response.get("answer"):
            parts.append(f"**Answer:** {response['answer']}\n")

        parts.append("**Sources:**")
        for i, result in enumerate(response.get("results", []), 1):
            title = result.get("title", "Untitled")
            url = result.get("url", "")
            snippet = result.get("content", "")[:300]
            parts.append(f"{i}. [{title}]({url})\n   {snippet}")

        return "\n".join(parts)


def get_search_tool(
    search_depth: str = "basic",
    topic: str = "general",
    max_results: int = 5,
) -> TavilySearchTool | None:
    """Create a Tavily web-search tool. Returns None when API key is not configured."""
    if not settings.TAVILY_API_KEY:
        logger.info("TAVILY_API_KEY not set — web search disabled for this agent")
        return None
    return TavilySearchTool(
        search_depth=search_depth,
        topic=topic,
        max_results=max_results,
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

    def on_phase_in_review(self, phase_type: str) -> None:
        self._publish({
            "type": "phase_in_review",
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

    # Inject confirmed user decisions/constraints into every agent run
    constraints = project_data.get("constraints")
    if constraints:
        constraint_lines = "\n".join(f"  - {k}: {v}" for k, v in constraints.items())
        parts.append(f"\n--- Confirmed User Decisions (MUST be respected) ---\n{constraint_lines}")

    if project_data.get("rag_context"):
        parts.append(f"\n--- Prior Phase Context ---\n{project_data['rag_context']}")

    # Outputs from agents that were skipped in a targeted re-run
    if project_data.get("prior_agent_outputs"):
        parts.append(f"\n--- Context From Other Agents (already completed) ---\n{project_data['prior_agent_outputs']}")

    if project_data.get("user_feedback"):
        parts.append(f"\n{project_data['user_feedback']}")

    return "\n".join(parts)


def parse_agent_output(output: str) -> dict[str, Any]:
    """Attempt to parse structured JSON from agent output, fallback to raw text."""
    try:
        return json.loads(output)
    except (json.JSONDecodeError, TypeError):
        return {"raw_output": output}
