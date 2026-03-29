/**
 * Landing Page generation DAG
 *
 * START ── copy_writer (gpt-4o) ── page_builder (gpt-4o) ── END
 *
 * Sequential: CopyWriter generates structured copy JSON,
 * then PageBuilder renders it into a complete Tailwind HTML page.
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { copyWriterNode } from "../nodes/landing-page/copy-writer"
import { pageBuilderNode } from "../nodes/landing-page/page-builder"

export function buildLandingPageGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("copy_writer", copyWriterNode)
    .addNode("page_builder", pageBuilderNode)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "copy_writer")
  g.addEdge("copy_writer", "page_builder")
  g.addEdge("page_builder", END)

  return graph.compile()
}
