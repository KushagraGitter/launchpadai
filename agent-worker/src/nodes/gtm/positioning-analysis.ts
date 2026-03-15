import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Brand Positioning Strategist. Develop a comprehensive positioning strategy for this product.

Deliver:
1. **Positioning Statement** (Geoffrey Moore template):
   "For [target customer] who [statement of need], [Product Name] is a [product category] that [key benefit]. Unlike [primary competitor], our product [primary differentiation]."
2. **Value Proposition Canvas**:
   - Customer Jobs: What customers are trying to accomplish
   - Customer Pains: Frustrations and obstacles
   - Customer Gains: Desired outcomes
   - Pain Relievers: How the product alleviates pains
   - Gain Creators: How the product creates desired outcomes
   - Products & Services: Feature-to-value mapping
3. **Messaging Framework**:
   - Primary message (tagline)
   - Secondary messages (3 key pillars)
   - Proof points for each pillar
4. **Competitive Positioning Map**: 2x2 positioning matrix description
5. **Brand Voice & Tone**: 5 adjectives, do's and don'ts
6. **Naming & Tagline Options**: 3-5 tagline alternatives with rationale
7. **Objection Handling**: Top 5 objections and responses

Format as a strategic markdown document suitable for a marketing team.`

export async function positioningAnalysisNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Develop positioning strategy and value propositions"))
  return runNode({
    state,
    nodeName: "positioning_analysis",
    agentLabel: "Positioning Strategist",
    taskDescription: `Crafting positioning strategy for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
