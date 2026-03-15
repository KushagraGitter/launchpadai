import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string, priorOutputs: string) => `${ctx}

--- Prior Discovery Outputs ---
${priorOutputs}
---

You are an Opportunity Mapper — a strategic analyst who has mapped competitive landscapes for 50+ startups from seed to Series B. You look at a space from multiple angles: direct competitors, indirect substitutes, potential acquirers, platform shifts, and regulation changes.

Produce a comprehensive **Opportunity Map** document.

## Competitive Landscape
Map the competitive space conversationally. Search for real data.
- **Direct competitors**: Who solves the same problem the same way? For each: name, pricing, target user, key strength, key weakness
- **Indirect substitutes**: What do users use instead (even if it wasn't built for this problem)?
- **Venture activity**: Any recent funding in this space? Hot or cold?

## Whitespace Analysis
Given the competitive landscape, where is the genuine opening? Be specific — 'underserved' is not enough. Name the exact gap.

## Adjacent Opportunities
What adjacent problems or user segments could this idea expand into once the core is validated? List 2-3 with brief rationale.

## Success Criteria (Pre-Validation)
Define measurable success criteria BEFORE running validation. Complete these sentences:
- 'This idea is validated when we have [X number] of [type of users] willing to [pay $Y / sign up / do Z]'
- 'The MVP is a success if it achieves [metric] within [timeframe]'
- 'We should pivot if [condition] after [timeframe]'

## Timing Assessment
Is NOW the right time for this idea? What tailwinds / headwinds exist? What would make this much easier in 2 years that doesn't exist today?

IMPORTANT: Use web search to ground your output in real evidence. Do NOT fabricate examples. Cite sources with URLs where you have them.`

export async function opportunityMappingNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const problemOutput = state.nodeResults?.problem_exploration?.content ?? ""
  const assumptionOutput = state.nodeResults?.assumption_challenge?.content ?? ""
  const priorOutputs = [
    problemOutput ? `Problem Explorer:\n${problemOutput.slice(0, 2000)}` : "",
    assumptionOutput ? `Assumption Challenger:\n${assumptionOutput.slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n")

  const prompt = PROMPT_TEMPLATE(
    buildContextPrompt(state, "Map the competitive landscape and adjacent opportunities"),
    priorOutputs
  )
  return runNode({
    state,
    nodeName: "opportunity_mapping",
    agentLabel: "Opportunity Mapper",
    taskDescription: `Mapping opportunities for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
