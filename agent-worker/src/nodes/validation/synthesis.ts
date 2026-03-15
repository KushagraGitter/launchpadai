import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildSynthesisPrompt(state: PhaseStateType): string {
  const results = state.nodeResults
  const researchSections: string[] = []

  if (results.market_size) {
    researchSections.push(`## Market Size Research\n${results.market_size.content}`)
  }
  if (results.competitor_analysis) {
    researchSections.push(`## Competitor Analysis\n${results.competitor_analysis.content}`)
  }
  if (results.technical_feasibility) {
    researchSections.push(`## Technical Feasibility\n${results.technical_feasibility.content}`)
  }
  if (results.persona_research) {
    researchSections.push(`## Persona Research\n${results.persona_research.content}`)
  }

  const ctx = buildContextPrompt(state, "Synthesize all research into a validation scorecard")
  const researchData = researchSections.length > 0
    ? `\n\n--- Research Data ---\n${researchSections.join("\n\n")}`
    : ""

  return `${ctx}${researchData}

You are a Validation Synthesizer. Based on ALL the research above, create a comprehensive validation report.

Synthesize the research into:
1. **Executive Summary**: 3-4 sentence overview of the opportunity
2. **Validation Scorecard** (score each 1-10):
   - Market Size & Growth: X/10
   - Problem Severity: X/10
   - Competitive Advantage: X/10
   - Technical Feasibility: X/10
   - Revenue Potential: X/10
   - **Overall Score: X/10**
3. **Key Strengths**: Top 3 reasons this idea is viable
4. **Key Risks**: Top 3 risks that could derail the product
5. **Critical Assumptions**: What must be true for this to succeed
6. **Go/No-Go Recommendation**: Clear recommendation with rationale
7. **Next Steps**: 3-5 specific actions to take before building

Format as a polished markdown document suitable for investors and stakeholders.`
}

export async function synthesisNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = buildSynthesisPrompt(state)
  return runNode({
    state,
    nodeName: "synthesis",
    agentLabel: "Validation Synthesis",
    taskDescription: `Synthesizing validation findings for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt,
    useSearch: false,
  })
}
