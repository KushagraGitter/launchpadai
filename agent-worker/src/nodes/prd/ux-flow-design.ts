import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildUxPrompt(state: PhaseStateType): string {
  const userStories = state.nodeResults.user_story_mapping?.content || ""
  const features = state.nodeResults.feature_prioritization?.content || ""
  const ctx = buildContextPrompt(state, "Design UX flows and wireframe descriptions")
  const priorData = [
    userStories && `## User Stories\n${userStories}`,
    features && `## Feature Priorities\n${features}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${priorData ? `\n\n--- Prior Analysis ---\n${priorData}` : ""}

You are a UX Flow Designer. Design the user experience flows and describe screen-level wireframes.

Deliver:
1. **Information Architecture**: Site map / app navigation structure (use ASCII tree or nested list)
2. **Key User Flows** (describe 4-6 core flows step-by-step):
   - Onboarding/Signup flow
   - Core value delivery flow
   - Settings/Profile flow
   - Other critical flows based on the product
3. **Screen Wireframe Descriptions**: For each key screen, describe:
   - Screen name and purpose
   - Key UI components (navigation, forms, tables, etc.)
   - User actions available
   - Navigation to/from other screens
4. **Design System Notes**:
   - Recommended component library (e.g., shadcn/ui, MUI, Chakra)
   - Color scheme suggestions
   - Typography recommendations
5. **Accessibility Requirements**: Key A11y considerations
6. **Mobile Responsiveness**: Mobile-first or responsive design notes

Format as detailed markdown with ASCII diagrams where helpful.`
}

export async function uxFlowDesignNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "ux_flow_design",
    agentLabel: "UX Flow Designer",
    taskDescription: `Designing UX flows for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt: buildUxPrompt(state),
  })
}
