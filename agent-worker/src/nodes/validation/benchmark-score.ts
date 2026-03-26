/**
 * BenchmarkScoreNode — runs after synthesis to produce a structured 6-dimension
 * benchmark score stored as a JSON artifact.
 *
 * Output schema (stored in artifact.content JSONB):
 * {
 *   dimensions: {
 *     market_size:          { score: 0-10, rationale: string },
 *     timing:               { score: 0-10, rationale: string },
 *     competition:          { score: 0-10, rationale: string },
 *     technical_feasibility:{ score: 0-10, rationale: string },
 *     monetization:         { score: 0-10, rationale: string },
 *     founder_market_fit:   { score: 0-10, rationale: string },
 *   },
 *   overall_score:      number  (weighted avg, 1 decimal)
 *   percentile_estimate: number  (0-100, vs startup population)
 *   verdict:            string  (e.g. "Strong Opportunity")
 *   one_line_summary:   string
 *   biggest_strength:   string
 *   biggest_risk:       string
 * }
 */

import { HumanMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { config } from "../../config"
import * as publisher from "../../redis/publisher"
import { buildContextPrompt, estimateTokens } from "../helpers"
import { logger } from "../../logger"
import type { PhaseStateType } from "../../graphs/state"
import type { NodeResult } from "../../types"

// Weights for overall score (must sum to 1)
const DIMENSION_WEIGHTS: Record<string, number> = {
  market_size: 0.25,
  timing: 0.15,
  competition: 0.20,
  technical_feasibility: 0.15,
  monetization: 0.15,
  founder_market_fit: 0.10,
}

function buildBenchmarkPrompt(state: PhaseStateType): string {
  const results = state.nodeResults
  const researchSections: string[] = []

  if (results.market_size) {
    researchSections.push(`## Market Size Research\n${results.market_size.content}`)
  }
  if (results.competitor_analysis) {
    researchSections.push(`## Competitor Analysis\n${results.competitor_analysis.content}`)
  }
  if (results.technical_feasibility) {
    researchSections.push(`## Technical Feasibility\n${results.technical_feasibility.content}`)
  }
  if (results.persona_research) {
    researchSections.push(`## Persona Research\n${results.persona_research.content}`)
  }
  if (results.synthesis) {
    researchSections.push(`## Validation Synthesis\n${results.synthesis.content}`)
  }

  const ctx = buildContextPrompt(state, "Generate a structured benchmark score for this idea")
  const researchData = researchSections.length > 0
    ? `\n\n--- Research & Validation Data ---\n${researchSections.join("\n\n")}`
    : ""

  return `${ctx}${researchData}

You are an expert startup analyst with deep knowledge of thousands of funded and failed startups.

Based on all the research and validation data above, score this idea across 6 dimensions compared to the broader startup population.

Score each dimension 1-10 where:
- 1-3 = Weak (bottom 30% of startup ideas in this dimension)
- 4-6 = Average (middle 40%)
- 7-8 = Strong (top 20%)
- 9-10 = Exceptional (top 5%)

DIMENSION DEFINITIONS:
- market_size: Total addressable market size, growth rate, and trajectory
- timing: Is now the right time? Technology readiness, market awareness, regulatory tailwinds
- competition: Differentiation, competitive moat, barriers to entry vs incumbents
- technical_feasibility: Can this be built with today's technology? Complexity vs capability
- monetization: Clarity of revenue model, willingness to pay, pricing power
- founder_market_fit: How well does the founder's background align with this problem space?

For percentile_estimate: Estimate what percentile this idea falls in compared to all startup ideas you've analyzed (0-100). Be honest and calibrated — most ideas score 40-65th percentile.

For verdict, use exactly one of: "Exceptional Opportunity" | "Strong Opportunity" | "Viable Opportunity" | "Risky Bet" | "Needs Rethinking"

Return ONLY valid JSON matching this exact schema — no markdown, no explanation, just JSON:
{
  "dimensions": {
    "market_size":           { "score": <1-10>, "rationale": "<1-2 sentences>" },
    "timing":                { "score": <1-10>, "rationale": "<1-2 sentences>" },
    "competition":           { "score": <1-10>, "rationale": "<1-2 sentences>" },
    "technical_feasibility": { "score": <1-10>, "rationale": "<1-2 sentences>" },
    "monetization":          { "score": <1-10>, "rationale": "<1-2 sentences>" },
    "founder_market_fit":    { "score": <1-10>, "rationale": "<1-2 sentences>" }
  },
  "overall_score": <number with 1 decimal>,
  "percentile_estimate": <0-100 integer>,
  "verdict": "<one of the 5 verdicts>",
  "one_line_summary": "<punchy 1-sentence take on this idea's potential>",
  "biggest_strength": "<the single strongest thing going for this idea>",
  "biggest_risk": "<the single most dangerous risk>"
}`
}

function computeWeightedScore(dimensions: Record<string, { score: number }>): number {
  let weighted = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    if (dimensions[key]?.score != null) {
      weighted += dimensions[key].score * weight
      totalWeight += weight
    }
  }
  if (totalWeight === 0) return 0
  return Math.round((weighted / totalWeight) * 10) / 10
}

export async function benchmarkScoreNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const nodeName = "benchmark_score"
  const agentLabel = "Benchmark Scorer"
  const taskDescription = `Scoring ${state.projectData.name} against startup benchmark database`

  await publisher.agentStart(state, agentLabel, taskDescription)

  try {
    const llm = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: config.OPENAI_API_KEY,
      temperature: 0,       // deterministic scoring
      streaming: false,     // we need the full JSON in one shot
    })

    const prompt = buildBenchmarkPrompt(state)
    const response = await llm.invoke([new HumanMessage(prompt)])
    const rawText = typeof response.content === "string" ? response.content : ""

    // Strip any accidental markdown fences
    const cleanJson = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleanJson) as Record<string, unknown>
    } catch {
      logger.warn("BenchmarkScoreNode: JSON parse failed, using raw output", { rawText })
      parsed = { raw_output: rawText, parse_error: true }
    }

    // Recompute overall_score from dimensions to ensure consistency
    const dims = parsed.dimensions as Record<string, { score: number }> | undefined
    if (dims && typeof dims === "object") {
      parsed.overall_score = computeWeightedScore(dims)
    }

    // Build markdown summary for the artifact viewer
    const overallScore = parsed.overall_score as number ?? 0
    const percentile = parsed.percentile_estimate as number ?? 0
    const verdict = parsed.verdict as string ?? "Unknown"
    const summary = parsed.one_line_summary as string ?? ""
    const strength = parsed.biggest_strength as string ?? ""
    const risk = parsed.biggest_risk as string ?? ""

    const dimensionLines = dims
      ? Object.entries(dims)
          .map(([key, val]) => {
            const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            const dim = val as { score: number; rationale: string }
            return `| **${label}** | ${dim.score}/10 | ${dim.rationale} |`
          })
          .join("\n")
      : ""

    const markdownContent = `# Benchmark Score — ${state.projectData.name}

## Verdict: ${verdict}

**Overall Score: ${overallScore}/10** — Top ${100 - percentile}% of startup ideas

> ${summary}

---

## Dimension Scores

| Dimension | Score | Rationale |
|---|---|---|
${dimensionLines}

---

## Key Insights

**💪 Biggest Strength**
${strength}

**⚠️ Biggest Risk**
${risk}

---

*Benchmark scores compare this idea against startup patterns across market size, timing, competition, technical feasibility, monetization clarity, and founder-market fit.*`

    await publisher.agentComplete(state, agentLabel, `Score: ${overallScore}/10 — ${verdict} (${percentile}th percentile)`)

    const result: NodeResult = {
      nodeName,
      agentLabel,
      content: markdownContent,
      contentJson: parsed,
      tokensUsed: estimateTokens(rawText),
      completedAt: new Date(),
    }

    logger.info("BenchmarkScore computed", {
      projectId: state.projectId,
      overallScore,
      percentile,
      verdict,
    })

    return { nodeResults: { [nodeName]: result } }
  } catch (err) {
    const errorMsg = String(err)
    logger.error("BenchmarkScoreNode failed", { error: errorMsg })
    await publisher.agentComplete(state, agentLabel, `ERROR: ${errorMsg}`.slice(0, 500))

    const result: NodeResult = {
      nodeName,
      agentLabel,
      content: "",
      contentJson: { error: errorMsg },
      tokensUsed: 0,
      completedAt: new Date(),
      error: errorMsg,
    }

    return {
      nodeResults: { [nodeName]: result },
      errors: [errorMsg],
    }
  }
}
