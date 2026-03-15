import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildPrdPrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const sections = [
    r.requirements_extraction && `## Requirements Analysis\n${r.requirements_extraction.content}`,
    r.user_story_mapping && `## User Stories\n${r.user_story_mapping.content}`,
    r.feature_prioritization && `## Feature Prioritization\n${r.feature_prioritization.content}`,
    r.ux_flow_design && `## UX Flows\n${r.ux_flow_design.content}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const ctx = buildContextPrompt(state, "Assemble the complete Product Requirements Document")

  return `${ctx}${sections ? `\n\n--- Research Inputs ---\n${sections}` : ""}

You are a PRD Writer. Using ALL the analysis above, write a comprehensive, publication-ready Product Requirements Document.

Structure the PRD as follows:

# Product Requirements Document: [Product Name]

## 1. Executive Summary
## 2. Problem & Opportunity
## 3. Product Vision & Goals
## 4. Target Users & Personas
## 5. Success Metrics & KPIs
## 6. Functional Requirements
   ### 6.1 Core Features (MVP)
   ### 6.2 Post-MVP Features
## 7. Non-Functional Requirements
## 8. User Stories & Acceptance Criteria
## 9. UX/UI Requirements
## 10. Technical Architecture Overview
## 11. Out of Scope
## 12. Risks & Mitigations
## 13. Timeline & Milestones
## 14. Open Questions

Write in professional product management language. Be specific and actionable throughout. This document will be handed directly to the engineering team.`
}

export async function prdAssemblyNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "prd_assembly",
    agentLabel: "PRD Writer",
    taskDescription: `Writing the comprehensive PRD for ${state.projectData.name}`,
    taskType: "formatting",
    prompt: buildPrdPrompt(state),
  })
}
