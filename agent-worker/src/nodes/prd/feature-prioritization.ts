import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildPrioritizationPrompt(state: PhaseStateType): string {
  const requirements = state.nodeResults.requirements_extraction?.content || ""
  const userStories = state.nodeResults.user_story_mapping?.content || ""

  const ctx = buildContextPrompt(state, "Prioritize features using MoSCoW framework")
  const researchData = [requirements && `## Requirements\n${requirements}`, userStories && `## User Stories\n${userStories}`]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${researchData ? `\n\n--- Prior Analysis ---\n${researchData}` : ""}

You are a Feature Prioritizer. Using the requirements and user stories above, apply the MoSCoW prioritization framework.

Deliver:
1. **MoSCoW Matrix**:
   - **Must Have (M)**: Core features for v1 launch — without these, the product fails
   - **Should Have (S)**: Important but not critical for launch
   - **Could Have (C)**: Nice-to-have if time permits
   - **Won't Have (W)**: Explicitly out of scope for v1
2. **MVP Feature Set**: Exact list of features for the MVP (Must Haves only)
3. **Feature Scoring Table**: Score each Must/Should feature on:
   - User Value (1-5)
   - Business Value (1-5)
   - Implementation Effort (1-5, lower = easier)
   - Priority Score = (User Value + Business Value) / Effort
4. **Development Roadmap**: Phase 1 (MVP), Phase 2 (Growth), Phase 3 (Scale)
5. **Dependency Graph**: Which features depend on others

Format as structured markdown with tables.`
}

export async function featurePrioritizationNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "feature_prioritization",
    agentLabel: "Feature Prioritizer",
    taskDescription: `Prioritizing features using MoSCoW for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt: buildPrioritizationPrompt(state),
  })
}
