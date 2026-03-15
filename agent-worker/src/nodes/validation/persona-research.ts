import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a User Persona Researcher. Build detailed user personas and identify the core pain points this product solves.

Deliver comprehensive persona research:
1. **Primary Persona**: Detailed persona with name, demographics, job title, goals, frustrations, and a day-in-the-life narrative
2. **Secondary Persona**: Second most important user type
3. **Pain Points**: Top 5-7 specific, vivid pain points each persona experiences today
4. **Jobs-to-be-Done**: What functional, emotional, and social jobs are personas trying to accomplish?
5. **Buying Triggers**: What would make them seek and adopt a new solution?
6. **Willingness to Pay**: Price sensitivity and budget ranges per persona
7. **Where They Hang Out**: Online communities, forums, events, influencers they follow
8. **Discovery Channels**: How they typically find new tools/products

Format each persona as a structured markdown section. Make personas specific and data-driven, not generic.`

export async function personaResearchNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Build detailed user personas and pain points"))
  return runNode({
    state,
    nodeName: "persona_research",
    agentLabel: "Persona Research",
    taskDescription: `Building user personas for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
