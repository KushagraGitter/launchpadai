import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Market Research Analyst. Analyze the total addressable market (TAM), serviceable addressable market (SAM), and serviceable obtainable market (SOM) for this product idea.

Provide a detailed analysis covering:
1. **Market Size**: TAM/SAM/SOM with specific numbers and sources
2. **Market Growth Rate**: YoY growth trends and projections (3-5 years)
3. **Key Market Segments**: Primary customer segments and their sizes
4. **Market Trends**: Major trends driving or hindering this market
5. **Geographic Focus**: Top markets by region
6. **Competitive Density**: Number and nature of existing players
7. **Market Readiness**: Is the market mature, emerging, or nascent?

Format your response in clear markdown with headers and bullet points. Include specific data points and cite reasoning for estimates.`

export async function marketSizeNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Analyze the market size and opportunity"))
  return runNode({
    state,
    nodeName: "market_size",
    agentLabel: "Market Size Research",
    taskDescription: `Analyzing TAM/SAM/SOM for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
