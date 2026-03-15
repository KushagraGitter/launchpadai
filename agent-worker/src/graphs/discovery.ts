/**
 * Phase 0: Discovery DAG
 *
 * START ── problem_exploration ── assumption_challenge ── opportunity_mapping ── brief_building ── END
 *
 * Sequential: each agent builds on the outputs of prior agents.
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { problemExplorationNode } from "../nodes/discovery/problem-exploration"
import { assumptionChallengeNode } from "../nodes/discovery/assumption-challenge"
import { opportunityMappingNode } from "../nodes/discovery/opportunity-mapping"
import { briefBuildingNode } from "../nodes/discovery/brief-building"

export function buildDiscoveryGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("problem_exploration", problemExplorationNode)
    .addNode("assumption_challenge", assumptionChallengeNode)
    .addNode("opportunity_mapping", opportunityMappingNode)
    .addNode("brief_building", briefBuildingNode)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "problem_exploration")
  g.addEdge("problem_exploration", "assumption_challenge")
  g.addEdge("assumption_challenge", "opportunity_mapping")
  g.addEdge("opportunity_mapping", "brief_building")
  g.addEdge("brief_building", END)

  return graph.compile()
}
