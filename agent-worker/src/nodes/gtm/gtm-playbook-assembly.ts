import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildGtmPlaybookPrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const sections = [
    r.positioning_analysis && `## Positioning Strategy\n${r.positioning_analysis.content}`,
    r.channel_research && `## Channel Strategy\n${r.channel_research.content}`,
    r.content_strategy && `## Content Strategy\n${r.content_strategy.content}`,
    r.launch_timeline && `## Launch Timeline\n${r.launch_timeline.content}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const ctx = buildContextPrompt(state, "Assemble the complete GTM playbook")

  return `${ctx}${sections ? `\n\n--- GTM Inputs ---\n${sections}` : ""}

You are a GTM Strategist. Create the final, comprehensive Go-to-Market Playbook.

Assemble a polished GTM_PLAYBOOK.md:

# Go-to-Market Playbook: [Product Name]

## Executive Summary
- GTM strategy in 3 sentences
- Key success metrics for launch

## 1. Market Opportunity
- Target market size and growth
- Ideal Customer Profile (ICP)

## 2. Positioning & Messaging
- Positioning statement
- Key messages for each persona
- Tagline options

## 3. Channel Strategy
- Primary channels (ranked)
- Channel-specific tactics
- Budget allocation

## 4. Content & Marketing Plan
- Content pillars
- 90-day content calendar overview
- Launch content checklist

## 5. Launch Playbook
- Launch strategy
- Pre-launch checklist
- Launch day schedule
- Post-launch actions

## 6. Metrics & Goals
- North Star Metric
- Leading indicators
- 30/60/90 day targets

## 7. Team & Resource Requirements
- Roles needed for GTM execution
- Tool stack recommendations

## 8. Quick Reference: First 30 Days
- Week-by-week action items

Format as a single, professional markdown document ready to share with the founding team.`
}

export async function gtmPlaybookAssemblyNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "gtm_playbook_assembly",
    agentLabel: "GTM Playbook Assembler",
    taskDescription: `Assembling GTM playbook for ${state.projectData.name}`,
    taskType: "formatting",
    prompt: buildGtmPlaybookPrompt(state),
  })
}
