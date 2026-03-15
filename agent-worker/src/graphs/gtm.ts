/**
 * Phase 4: GTM DAG
 *
 * START ──┬── positioning_analysis (gpt-4o + Tavily)
 *         └── channel_research     (gpt-4o + Tavily)
 *              ├── content_strategy  (gpt-4o)
 *              └── launch_timeline   (gpt-4o-mini)
 *                   └── gtm_playbook_assembly (gpt-4o-mini) ── END
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { positioningAnalysisNode } from "../nodes/gtm/positioning-analysis"
import { channelResearchNode } from "../nodes/gtm/channel-research"
import { contentStrategyNode } from "../nodes/gtm/content-strategy"
import { launchTimelineNode } from "../nodes/gtm/launch-timeline"
import { gtmPlaybookAssemblyNode } from "../nodes/gtm/gtm-playbook-assembly"

export function buildGtmGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("positioning_analysis", positioningAnalysisNode)
    .addNode("channel_research", channelResearchNode)
    .addNode("content_strategy", contentStrategyNode)
    .addNode("launch_timeline", launchTimelineNode)
    .addNode("gtm_playbook_assembly", gtmPlaybookAssemblyNode)

  // Positioning and channel research run in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "positioning_analysis")
  g.addEdge(START, "channel_research")

  // Content strategy and launch timeline both need positioning + channels
  g.addEdge("positioning_analysis", "content_strategy")
  g.addEdge("channel_research", "content_strategy")
  g.addEdge("positioning_analysis", "launch_timeline")
  g.addEdge("channel_research", "launch_timeline")

  // Playbook assembly waits for both
  g.addEdge("content_strategy", "gtm_playbook_assembly")
  g.addEdge("launch_timeline", "gtm_playbook_assembly")

  g.addEdge("gtm_playbook_assembly", END)

  return graph.compile()
}
