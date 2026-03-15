import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Requirements Analyst. Extract and document all product requirements from the project idea and context.

Deliver structured requirements:
1. **Problem Statement**: Clear articulation of the problem being solved
2. **Product Vision**: One-sentence vision statement
3. **Success Metrics**: 5-7 measurable KPIs to track product success
4. **Functional Requirements**: Complete list of what the product must do (use "The system shall..." format)
   - Core features (must-have)
   - Secondary features (should-have)
5. **Non-Functional Requirements**:
   - Performance (response times, throughput)
   - Security requirements
   - Scalability requirements
   - Reliability/uptime requirements
6. **Constraints**: Technical, business, regulatory, or resource constraints
7. **Assumptions**: Assumptions made in these requirements
8. **Out of Scope**: Explicitly list what is NOT in scope for v1

Format as a structured markdown document with clear sections.`

export async function requirementsExtractionNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Extract and document all product requirements"))
  return runNode({
    state,
    nodeName: "requirements_extraction",
    agentLabel: "Requirements Analyst",
    taskDescription: `Gathering and analyzing product requirements for ${state.projectData.name}`,
    taskType: "formatting",
    prompt,
  })
}
