"""
GitHub API service — verifies tokens, lists repos, creates issues.
Uses httpx for async HTTP calls to the GitHub REST API v3.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
HEADERS_BASE = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def _headers(token: str) -> dict[str, str]:
    return {**HEADERS_BASE, "Authorization": f"Bearer {token}"}


@dataclass
class GitHubUser:
    login: str
    avatar_url: str
    name: str | None = None


@dataclass
class GitHubRepo:
    full_name: str  # "owner/repo"
    name: str
    private: bool
    description: str | None = None
    html_url: str = ""
    default_branch: str = "main"


@dataclass
class GitHubIssue:
    number: int
    html_url: str
    title: str


@dataclass
class ExportResult:
    repo: str
    issues_created: int
    issues: list[GitHubIssue] = field(default_factory=list)
    milestone_url: str | None = None
    errors: list[str] = field(default_factory=list)


async def verify_token(token: str) -> GitHubUser:
    """Verify a GitHub PAT and return the authenticated user."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GITHUB_API}/user", headers=_headers(token))
        if resp.status_code == 401:
            raise ValueError("Invalid GitHub token — authentication failed")
        resp.raise_for_status()
        data = resp.json()
        return GitHubUser(
            login=data["login"],
            avatar_url=data["avatar_url"],
            name=data.get("name"),
        )


async def list_repos(token: str, per_page: int = 100) -> list[GitHubRepo]:
    """List repos the authenticated user has push access to."""
    repos: list[GitHubRepo] = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                f"{GITHUB_API}/user/repos",
                headers=_headers(token),
                params={"sort": "updated", "per_page": per_page, "page": page, "affiliation": "owner,collaborator"},
            )
            resp.raise_for_status()
            data = resp.json()
            if not data:
                break
            for r in data:
                if r.get("permissions", {}).get("push", False):
                    repos.append(GitHubRepo(
                        full_name=r["full_name"],
                        name=r["name"],
                        private=r["private"],
                        description=r.get("description"),
                        html_url=r["html_url"],
                        default_branch=r.get("default_branch", "main"),
                    ))
            if len(data) < per_page:
                break
            page += 1
    return repos


async def create_milestone(token: str, repo: str, title: str, description: str = "") -> int | None:
    """Create a GitHub milestone and return its number."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{repo}/milestones",
            headers=_headers(token),
            json={"title": title, "description": description},
        )
        if resp.status_code == 422:
            # Milestone already exists — find it
            list_resp = await client.get(
                f"{GITHUB_API}/repos/{repo}/milestones",
                headers=_headers(token),
                params={"state": "open"},
            )
            list_resp.raise_for_status()
            for m in list_resp.json():
                if m["title"] == title:
                    return m["number"]
            return None
        resp.raise_for_status()
        return resp.json()["number"]


async def ensure_labels(token: str, repo: str, labels: list[str]) -> None:
    """Create labels if they don't exist (idempotent)."""
    LABEL_COLORS = {
        "setup": "0e8a16",
        "backend": "1d76db",
        "frontend": "f9d0c4",
        "infrastructure": "d93f0b",
        "testing": "fbca04",
        "launchpadai": "6366f1",
        "sprint-1": "bfd4f2",
        "sprint-2": "c2e0c6",
        "sprint-3": "fef2c0",
    }
    async with httpx.AsyncClient() as client:
        for label in labels:
            color = LABEL_COLORS.get(label.lower(), "ededed")
            resp = await client.post(
                f"{GITHUB_API}/repos/{repo}/labels",
                headers=_headers(token),
                json={"name": label, "color": color},
            )
            if resp.status_code == 422:
                continue  # Already exists
            if not resp.is_success:
                logger.warning("Failed to create label %s: %s", label, resp.text)


async def create_issue(
    token: str,
    repo: str,
    title: str,
    body: str,
    labels: list[str] | None = None,
    milestone: int | None = None,
) -> GitHubIssue:
    """Create a single GitHub issue."""
    payload: dict = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    if milestone:
        payload["milestone"] = milestone

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GITHUB_API}/repos/{repo}/issues",
            headers=_headers(token),
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return GitHubIssue(
            number=data["number"],
            html_url=data["html_url"],
            title=data["title"],
        )


def parse_tasks_from_markdown(markdown: str) -> list[dict]:
    """
    Parse task decomposition markdown into structured task dicts.
    Expected format from Task Decomposer agent:
    | ID | Task | Description | Hours | Dependencies | Assignee Role |
    """
    tasks: list[dict] = []
    current_category = "general"

    for line in markdown.split("\n"):
        # Detect category headers
        header_match = re.match(r"^#{1,3}\s+(?:\d+[.)]\s*)?(.+?)(?:\s*Tasks?\s*)?$", line.strip())
        if header_match:
            cat = header_match.group(1).strip().lower()
            for keyword in ["setup", "backend", "frontend", "infrastructure", "testing", "database", "api", "auth"]:
                if keyword in cat:
                    current_category = keyword
                    break
            continue

        # Parse table rows: | ID | Task | Description | Hours | Dependencies | Assignee |
        row_match = re.match(
            r"\|\s*([A-Z]+-?\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?)\s*h?\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|",
            line.strip(),
        )
        if row_match:
            task_id, title, desc, hours, deps, assignee = row_match.groups()
            tasks.append({
                "id": task_id.strip(),
                "title": title.strip(),
                "description": desc.strip(),
                "hours": float(hours),
                "dependencies": [d.strip() for d in deps.split(",") if d.strip() and d.strip() != "-" and d.strip() != "None"],
                "assignee": assignee.strip(),
                "category": current_category,
            })
            continue

        # Fallback: numbered list items like "1. **Task Title** — Description"
        list_match = re.match(r"^\d+\.\s+\*\*(.+?)\*\*\s*[-–—:]\s*(.+)$", line.strip())
        if list_match:
            title, desc = list_match.groups()
            tasks.append({
                "id": f"T-{len(tasks)+1}",
                "title": title.strip(),
                "description": desc.strip(),
                "hours": 0,
                "dependencies": [],
                "assignee": "",
                "category": current_category,
            })

    return tasks


async def export_tasks_as_issues(
    token: str,
    repo: str,
    project_name: str,
    tasks: list[dict],
) -> ExportResult:
    """
    Export parsed tasks as GitHub issues with labels and a milestone.
    Returns an ExportResult with all created issues.
    """
    result = ExportResult(repo=repo, issues_created=0)

    if not tasks:
        result.errors.append("No tasks found in artifact to export")
        return result

    # 1. Create milestone
    milestone_num = await create_milestone(
        token, repo,
        title=f"LaunchPadAI — {project_name}",
        description=f"Tasks auto-generated by LaunchPadAI for project: {project_name}",
    )

    # 2. Ensure labels exist
    categories = list(set(t.get("category", "general") for t in tasks))
    all_labels = categories + ["launchpadai"]
    await ensure_labels(token, repo, all_labels)

    # 3. Create issues
    # Build a map of task ID → issue number for dependency linking
    id_to_issue: dict[str, int] = {}

    for task in tasks:
        try:
            # Build issue body
            body_parts = [task.get("description", "")]

            if task.get("hours"):
                body_parts.append(f"\n**Estimated hours:** {task['hours']}h")
            if task.get("assignee"):
                body_parts.append(f"**Role:** {task['assignee']}")

            # Link dependencies to other issues
            deps = task.get("dependencies", [])
            if deps:
                dep_links = []
                for dep_id in deps:
                    if dep_id in id_to_issue:
                        dep_links.append(f"#{id_to_issue[dep_id]}")
                    else:
                        dep_links.append(dep_id)
                body_parts.append(f"\n**Depends on:** {', '.join(dep_links)}")

            body_parts.append("\n---\n*Created by [LaunchPadAI](https://launchpadai.com) — AI-powered task decomposition*")

            labels = [task.get("category", "general"), "launchpadai"]
            issue_title = f"[{task.get('id', '')}] {task['title']}" if task.get("id") else task["title"]

            issue = await create_issue(
                token=token,
                repo=repo,
                title=issue_title,
                body="\n".join(body_parts),
                labels=labels,
                milestone=milestone_num,
            )

            result.issues.append(issue)
            result.issues_created += 1

            if task.get("id"):
                id_to_issue[task["id"]] = issue.number

        except Exception as e:
            error_msg = f"Failed to create issue for task '{task.get('title', '?')}': {str(e)}"
            logger.error(error_msg)
            result.errors.append(error_msg)

    return result
