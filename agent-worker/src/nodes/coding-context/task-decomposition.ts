import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildTaskDecompositionPrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const arch = r.architecture_design?.content || ""
  const schema = r.schema_design?.content || ""
  const ctx = buildContextPrompt(state, "Decompose the product into development tasks")
  const priorData = [
    arch && `## Architecture\n${arch}`,
    schema && `## Schema Design\n${schema}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${priorData ? `\n\n--- Architecture Context ---\n${priorData}` : ""}

You are a Task Decomposer. Break down the entire product build into actionable development tasks.

Deliver a complete task breakdown:
1. **Project Setup Tasks** (5-10 tasks):
   - Repo setup, CI/CD, Docker, environment configuration
2. **Backend Tasks** organized by domain/module (30-50 tasks total):
   - Each task: ID, title, description, estimated hours, dependencies
   - Cover: Models/DB, API endpoints, business logic, auth, background jobs
3. **Frontend Tasks** (20-30 tasks):
   - Cover: Pages, components, state management, API integration, auth flows
4. **Infrastructure Tasks** (5-10 tasks):
   - Deployment, monitoring, security hardening
5. **Testing Tasks** (10-15 tasks):
   - Unit tests, integration tests, E2E tests
6. **Sprint Plan**: Organize tasks into 2-week sprints for a 3-person team
7. **Critical Path**: Tasks that must be sequential (dependencies)
8. **Parallel Work**: Tasks the team can work on simultaneously

Format as a detailed markdown document with task tables including: ID | Task | Description | Hours | Dependencies | Assignee Role`
}

export async function taskDecompositionNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "task_decomposition",
    agentLabel: "Task Decomposer",
    taskDescription: `Decomposing development tasks for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt: buildTaskDecompositionPrompt(state),
  })
}
