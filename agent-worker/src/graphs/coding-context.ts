/**
 * Phase 3: Coding Context DAG
 *
 * START ──┬── architecture_design (gpt-4o + Tavily)
 *         └── schema_design       (gpt-4o)
 *              ├── task_decomposition      (gpt-4o)
 *              └── cursorrules_generation  (gpt-4o-mini)
 *                   └── context_package_assembly (gpt-4o-mini) ── END
 */

import { StateGraph, START, END } from "@langchain/langgraph"
import { PhaseStateAnnotation } from "./state"
import { architectureDesignNode } from "../nodes/coding-context/architecture-design"
import { schemaDesignNode } from "../nodes/coding-context/schema-design"
import { taskDecompositionNode } from "../nodes/coding-context/task-decomposition"
import { cursorrulesGenerationNode } from "../nodes/coding-context/cursorrules-generation"
import { contextPackageAssemblyNode } from "../nodes/coding-context/context-package-assembly"

export function buildCodingContextGraph() {
  const graph = new StateGraph(PhaseStateAnnotation)

  graph
    .addNode("architecture_design", architectureDesignNode)
    .addNode("schema_design", schemaDesignNode)
    .addNode("task_decomposition", taskDecompositionNode)
    .addNode("cursorrules_generation", cursorrulesGenerationNode)
    .addNode("context_package_assembly", contextPackageAssemblyNode)

  // Architecture and schema run in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any
  g.addEdge(START, "architecture_design")
  g.addEdge(START, "schema_design")

  // Task decomposition and cursorrules both need architecture + schema
  g.addEdge("architecture_design", "task_decomposition")
  g.addEdge("schema_design", "task_decomposition")
  g.addEdge("architecture_design", "cursorrules_generation")
  g.addEdge("schema_design", "cursorrules_generation")

  // Assembly waits for both
  g.addEdge("task_decomposition", "context_package_assembly")
  g.addEdge("cursorrules_generation", "context_package_assembly")

  g.addEdge("context_package_assembly", END)

  return graph.compile()
}
