import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Technical Feasibility Analyst. Evaluate the technical viability of building this product.

Provide a detailed technical feasibility assessment:
1. **Core Technical Challenges**: Key engineering problems to solve
2. **Recommended Tech Stack**: Frontend, backend, database, infrastructure choices with justification
3. **Build vs Buy**: Key components to build vs use existing services/APIs
4. **Technical Risks**: Top 3-5 technical risks and mitigation strategies
5. **MVP Feasibility**: Can a functional MVP be built by a small team (2-3 devs) in 3-6 months?
6. **Scalability Considerations**: Technical requirements to scale to 100K users
7. **Regulatory/Compliance**: Any technical compliance requirements (GDPR, SOC2, HIPAA, etc.)
8. **Integration Requirements**: Key third-party integrations needed
9. **Development Complexity Score**: Rate 1-10 with justification

Format your response in clear markdown with specific technology recommendations.`

export async function technicalFeasibilityNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Evaluate technical feasibility and stack requirements"))
  return runNode({
    state,
    nodeName: "technical_feasibility",
    agentLabel: "Technical Feasibility",
    taskDescription: `Evaluating technical feasibility for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
