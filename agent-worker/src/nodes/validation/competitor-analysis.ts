import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Competitive Intelligence Analyst. Research and analyze the competitive landscape for this product idea.

Provide a comprehensive competitor analysis:
1. **Direct Competitors**: 3-5 direct competitors with names, URLs, funding, and key features
2. **Indirect Competitors**: Alternative solutions customers currently use
3. **Competitive Matrix**: Feature comparison table (markdown table format)
4. **Competitor Weaknesses**: Top gaps/pain points in existing solutions
5. **Differentiation Opportunities**: Where this product can stand out
6. **Barrier to Entry**: What makes it hard to compete in this space
7. **Market Leaders**: Who dominates and why
8. **Pricing Landscape**: Pricing models and ranges across competitors

Format your response in clear markdown. Include specific product names, pricing data, and verifiable facts.`

export async function competitorAnalysisNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Analyze the competitive landscape"))
  return runNode({
    state,
    nodeName: "competitor_analysis",
    agentLabel: "Competitor Analysis",
    taskDescription: `Researching competitive landscape for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
