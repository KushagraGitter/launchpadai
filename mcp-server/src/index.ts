#!/usr/bin/env node
/**
 * LaunchPadAI MCP Server
 *
 * Exposes LaunchPadAI's idea validation pipeline as MCP tools.
 * Works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client.
 *
 * Usage:
 *   LAUNCHPADAI_API_KEY=lpai_... npx launchpadai-mcp
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "launchpadai": {
 *         "command": "npx",
 *         "args": ["launchpadai-mcp"],
 *         "env": { "LAUNCHPADAI_API_KEY": "lpai_..." }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { LaunchPadAPIClient } from "./api-client.js"

const server = new McpServer({
  name: "launchpadai",
  version: "0.1.0",
})

let client: LaunchPadAPIClient

// ── Tool: validate_idea ──────────────────────────────────────────────────────

server.tool(
  "validate_idea",
  "Submit a startup/product idea for AI-powered validation. Creates a project, runs discovery analysis with 4 parallel research agents, then returns the project ID. Use get_benchmark_score after validation completes for the structured score.",
  {
    idea: z.string().describe("The product/startup idea to validate (1-3 sentences)"),
    name: z.string().optional().describe("Project name (auto-generated from idea if omitted)"),
    domain: z.string().optional().describe("Industry/domain (e.g. 'Fintech', 'Healthcare AI')"),
    target_audience: z.string().optional().describe("Target audience description"),
  },
  async ({ idea, name, domain, target_audience }) => {
    const result = await client.validateIdea({ idea, name, domain, target_audience })
    return {
      content: [{
        type: "text" as const,
        text: [
          `✅ Idea submitted for validation!`,
          ``,
          `**Project ID:** \`${result.project_id}\``,
          `**Phase ID:** \`${result.phase_id}\``,
          `**Status:** ${result.status}`,
          ``,
          `The discovery phase is now running with 4 AI agents analyzing your idea in parallel:`,
          `- Problem Explorer`,
          `- Assumption Challenger`,
          `- Opportunity Mapper`,
          `- Brief Builder`,
          ``,
          `⏳ This typically takes 30-60 seconds. Use \`get_project_phases\` to check status,`,
          `then \`get_benchmark_score\` once validation completes.`,
        ].join("\n"),
      }],
    }
  }
)

// ── Tool: get_benchmark_score ────────────────────────────────────────────────

server.tool(
  "get_benchmark_score",
  "Get the AI Benchmark Score for a validated idea. Returns a structured score across 6 dimensions (market size, timing, competition, technical feasibility, monetization, founder-market fit) plus an overall score, percentile estimate, and verdict.",
  {
    project_id: z.string().describe("The project UUID from validate_idea"),
  },
  async ({ project_id }) => {
    const score = await client.getBenchmarkScore(project_id)

    const dimLines = Object.entries(score.dimensions)
      .map(([key, val]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        return `| ${label} | ${val.score}/10 | ${val.rationale} |`
      })
      .join("\n")

    return {
      content: [{
        type: "text" as const,
        text: [
          `# Benchmark Score — ${score.verdict}`,
          ``,
          `**Overall: ${score.overall_score}/10** — Top ${100 - score.percentile_estimate}% of startup ideas`,
          ``,
          `> ${score.one_line_summary}`,
          ``,
          `| Dimension | Score | Rationale |`,
          `|---|---|---|`,
          dimLines,
          ``,
          `**💪 Biggest Strength:** ${score.biggest_strength}`,
          `**⚠️ Biggest Risk:** ${score.biggest_risk}`,
        ].join("\n"),
      }],
    }
  }
)

// ── Tool: list_projects ──────────────────────────────────────────────────────

server.tool(
  "list_projects",
  "List all LaunchPadAI projects for the authenticated user. Shows project name, status, and current phase.",
  {
    limit: z.number().optional().default(10).describe("Max projects to return"),
  },
  async ({ limit }) => {
    const result = await client.listProjects(limit)

    if (result.projects.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No projects found. Use `validate_idea` to create one!" }],
      }
    }

    const lines = result.projects.map((p) =>
      `- **${p.name}** (\`${p.id}\`) — Status: ${p.status}, Phase: ${p.current_phase || "none"}`
    )

    return {
      content: [{
        type: "text" as const,
        text: [`# Your Projects (${result.total})`, "", ...lines].join("\n"),
      }],
    }
  }
)

// ── Tool: get_project_phases ─────────────────────────────────────────────────

server.tool(
  "get_project_phases",
  "Check the status of all phases for a project. Useful to see if validation/PRD/etc has completed.",
  {
    project_id: z.string().describe("The project UUID"),
  },
  async ({ project_id }) => {
    const phases = await client.getProjectPhases(project_id)

    const statusEmoji: Record<string, string> = {
      pending: "⏳",
      queued: "📋",
      running: "🔄",
      in_review: "👀",
      accepted: "✅",
      completed: "✅",
      failed: "❌",
    }

    const lines = phases.map((p) => {
      const emoji = statusEmoji[p.status] || "❓"
      return `${emoji} **${p.phase_type}** — ${p.status} (${p.phase_id})`
    })

    return {
      content: [{
        type: "text" as const,
        text: [`# Phase Status`, "", ...lines].join("\n"),
      }],
    }
  }
)

// ── Tool: get_artifacts ──────────────────────────────────────────────────────

server.tool(
  "get_artifacts",
  "Get all AI-generated artifacts (reports, analyses, PRDs) for a project. Optionally filter by phase type.",
  {
    project_id: z.string().describe("The project UUID"),
    phase: z.string().optional().describe("Filter by phase: discovery, validation, prd, coding_context, gtm"),
  },
  async ({ project_id, phase }) => {
    const result = await client.getProjectArtifacts(project_id, phase)

    if (result.artifacts.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No artifacts found for this project/phase." }],
      }
    }

    const sections = result.artifacts.map((a) => {
      const content = a.markdown_content || JSON.stringify(a.content, null, 2)
      return `## ${a.title}\n*Agent: ${a.agent_name} | Type: ${a.artifact_type}*\n\n${content}`
    })

    return {
      content: [{
        type: "text" as const,
        text: [`# Artifacts for Project`, `Phase: ${phase || "all"}`, "", ...sections].join("\n\n"),
      }],
    }
  }
)

// ── Tool: run_phase ──────────────────────────────────────────────────────────

server.tool(
  "run_phase",
  "Trigger a specific phase (discovery, validation, prd, coding_context, gtm) for an existing project.",
  {
    project_id: z.string().describe("The project UUID"),
    phase_type: z.enum(["discovery", "validation", "prd", "coding_context", "gtm"]).describe("Which phase to run"),
  },
  async ({ project_id, phase_type }) => {
    const result = await client.runPhase(project_id, phase_type)
    return {
      content: [{
        type: "text" as const,
        text: [
          `✅ **${phase_type}** phase queued!`,
          ``,
          `Phase ID: \`${result.phase_id}\``,
          `${result.message}`,
          ``,
          `Use \`get_project_phases\` to check when it completes.`,
        ].join("\n"),
      }],
    }
  }
)

// ── Start server ─────────────────────────────────────────────────────────────

async function main() {
  try {
    client = new LaunchPadAPIClient()
  } catch (err) {
    console.error(String(err))
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
