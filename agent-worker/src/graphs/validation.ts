/**
 * Phase 1: Validation DAG
 *
 * START ──┬── market_size           (gpt-4o + Tavily)
 *         ├── competitor_analysis   (gpt-4o + Tavily)
 *         ├── technical_feasibility (gpt-4o + Tavily)
 *         └── persona_research      (gpt-4o + Tavily)
 *              └──────────────────── synthesis (gpt-4o)
 *                                       └────── benchmark_score (gpt-4o, JSON) ── END
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { marketSizeNode } from "../nodes/validation/market-size"
import { competitorAnalysisNode } from "../nodes/validation/competitor-analysis"
import { technicalFeasibilityNode } from "../nodes/validation/technical-feasibility"
import { personaResearchNode } from "../nodes/validation/persona-research"
import { synthesisNode } from "../nodes/validation/synthesis"
import { benchmarkScoreNode } from "../nodes/validation/benchmark-score"

export function buildValidationGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("market_size", marketSizeNode)
    .addNode("competitor_analysis", competitorAnalysisNode)
    .addNode("technical_feasibility", technicalFeasibilityNode)
    .addNode("persona_research", personaResearchNode)
    .addNode("synthesis", synthesisNode)
    .addNode("benchmark_score", benchmarkScoreNode)

  // All four research nodes run in parallel from START
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "market_size")
  g.addEdge(START, "competitor_analysis")
  g.addEdge(START, "technical_feasibility")
  g.addEdge(START, "persona_research")

  // Synthesis waits for all four research nodes
  g.addEdge("market_size", "synthesis")
  g.addEdge("competitor_analysis", "synthesis")
  g.addEdge("technical_feasibility", "synthesis")
  g.addEdge("persona_research", "synthesis")

  // Benchmark score runs after synthesis (needs all research + synthesis output)
  g.addEdge("synthesis", "benchmark_score")
  g.addEdge("benchmark_score", END)

  return graph.compile()
}
