import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string, priorOutputs: string) => `${ctx}

--- All Discovery Outputs ---
${priorOutputs}
---

You are a Brief Builder — a product strategist and technical writer who has authored project briefs for 100+ funded startups. You know how to distil messy, contradictory discovery outputs into a single coherent document.

This Brief is the master context document that will be fed into EVERY downstream phase (Validation, PRD, Coding Context, GTM). It must be complete, precise, and actionable.

Synthesise everything into a single, opinionated **Project Brief** document.

## Executive Summary
3-5 sentences. What is this, who is it for, why now, and what is the single biggest insight from the discovery session?

## The Real Problem (Refined)
The final, refined problem statement after discovery. One paragraph.

## Target User
The PRIMARY user for the MVP. Name them (persona name), describe their context, their biggest pain point, and their current workaround.

## Proposed Solution Hypothesis
One paragraph describing the solution HYPOTHESIS — not a spec. Make it clear it's a hypothesis to be validated.

## Key Assumptions (Ranked by Risk)
Top 5 assumptions from the Assumptions Analysis, ranked by risk. Each: assumption + risk tier + validation approach.

## Competitive Position
One paragraph: where this idea sits in the competitive landscape and what the genuine differentiation claim is.

## Success Criteria
The concrete, measurable success criteria defined in the Opportunity Map.

## MVP Scope Recommendation
What should and should NOT be in the MVP. Be opinionated. Use a simple in/out table format.

## Open Questions
Top 3-5 questions that the Validation phase MUST answer before the founder should commit to building.

## Discovery Session Verdict
An honest one-paragraph assessment: Is this idea worth pursuing into Validation? What is the single most important thing the founder needs to be aware of going in?

Your brief should be comprehensive (600-1200 words), specific to this idea, and make clear recommendations.`

export async function briefBuildingNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const problemOutput = state.nodeResults?.problem_exploration?.content ?? ""
  const assumptionOutput = state.nodeResults?.assumption_challenge?.content ?? ""
  const opportunityOutput = state.nodeResults?.opportunity_mapping?.content ?? ""

  const priorOutputs = [
    problemOutput ? `Problem Explorer:\n${problemOutput.slice(0, 3000)}` : "",
    assumptionOutput ? `Assumption Challenger:\n${assumptionOutput.slice(0, 3000)}` : "",
    opportunityOutput ? `Opportunity Mapper:\n${opportunityOutput.slice(0, 3000)}` : "",
  ].filter(Boolean).join("\n\n")

  const prompt = PROMPT_TEMPLATE(
    buildContextPrompt(state, "Synthesise all discovery findings into a Project Brief"),
    priorOutputs
  )
  return runNode({
    state,
    nodeName: "brief_building",
    agentLabel: "Brief Builder",
    taskDescription: `Building the Project Brief for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt,
    useSearch: false,
  })
}
