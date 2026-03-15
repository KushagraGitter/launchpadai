/**
 * Phase 2: PRD DAG
 *
 * START ──┬── requirements_extraction (gpt-4o-mini)
 *         └── user_story_mapping      (gpt-4o-mini)
 *              ├── feature_prioritization (gpt-4o)
 *              └── ux_flow_design         (gpt-4o)
 *                   └── prd_assembly (gpt-4o-mini) ── END
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { requirementsExtractionNode } from "../nodes/prd/requirements-extraction"
import { userStoryMappingNode } from "../nodes/prd/user-story-mapping"
import { featurePrioritizationNode } from "../nodes/prd/feature-prioritization"
import { uxFlowDesignNode } from "../nodes/prd/ux-flow-design"
import { prdAssemblyNode } from "../nodes/prd/prd-assembly"

export function buildPrdGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("requirements_extraction", requirementsExtractionNode)
    .addNode("user_story_mapping", userStoryMappingNode)
    .addNode("feature_prioritization", featurePrioritizationNode)
    .addNode("ux_flow_design", uxFlowDesignNode)
    .addNode("prd_assembly", prdAssemblyNode)

  // Requirements and user stories run in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "requirements_extraction")
  g.addEdge(START, "user_story_mapping")

  // Feature prioritization and UX design both need requirements + user stories
  g.addEdge("requirements_extraction", "feature_prioritization")
  g.addEdge("user_story_mapping", "feature_prioritization")
  g.addEdge("requirements_extraction", "ux_flow_design")
  g.addEdge("user_story_mapping", "ux_flow_design")

  // PRD assembly waits for both
  g.addEdge("feature_prioritization", "prd_assembly")
  g.addEdge("ux_flow_design", "prd_assembly")

  g.addEdge("prd_assembly", END)

  return graph.compile()
}
