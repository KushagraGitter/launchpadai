import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Channel Strategist. Research and recommend the optimal marketing and distribution channels for this product.

Deliver:
1. **Channel Analysis** (evaluate 8-10 channels):
   For each channel: Potential Reach | Customer Acquisition Cost | Time to Results | Effort | Recommendation
   Channels to evaluate:
   - Content Marketing / SEO
   - Product Hunt / AppSumo launches
   - Social Media (specify which platforms)
   - Paid Ads (Google, Meta, LinkedIn)
   - Developer Communities (GitHub, Reddit, Discord, HN)
   - Email Marketing
   - Influencer / Creator Partnerships
   - Partnership & Integration ecosystem
   - Events / Conferences
   - Cold Outreach (email, LinkedIn)
2. **Primary Channel Strategy**: Top 2-3 channels to focus on first and why
3. **Channel Sequencing**: Which channels to activate in what order
4. **Budget Allocation**: Suggested % split across channels for a $5K/month budget
5. **Community Building**: Where and how to build a community around this product
6. **Partnership Opportunities**: Specific companies/integrations to target
7. **Early Adopter Strategy**: How to get the first 100 paying customers

Format as a detailed markdown document with a channel scoring table.`

export async function channelResearchNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Research optimal marketing and distribution channels"))
  return runNode({
    state,
    nodeName: "channel_research",
    agentLabel: "Channel Strategist",
    taskDescription: `Identifying optimal channels for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
