import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a User Story Mapper. Create comprehensive user stories and an epic breakdown for this product.

Deliver:
1. **Epic Map**: Organize user journeys into 4-6 epics
2. **User Stories per Epic**: For each epic, write 3-5 user stories in the format:
   "As a [persona], I want to [action] so that [benefit]"
   - Include acceptance criteria for each story (3-5 bullet points)
   - Assign story points (1, 2, 3, 5, 8, 13)
3. **Happy Path Journey**: Step-by-step user journey from signup to core value delivery
4. **Edge Cases**: 5-7 important edge cases to handle
5. **User Roles & Permissions**: Define all user roles and their permissions matrix

Format as structured markdown with tables for permissions and clear story formatting.`

export async function userStoryMappingNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Create user stories and epic breakdown"))
  return runNode({
    state,
    nodeName: "user_story_mapping",
    agentLabel: "User Story Mapper",
    taskDescription: `Creating user stories and epics for ${state.projectData.name}`,
    taskType: "formatting",
    prompt,
  })
}
