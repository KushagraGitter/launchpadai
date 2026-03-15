import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildLaunchTimelinePrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const positioning = r.positioning_analysis?.content || ""
  const channels = r.channel_research?.content || ""
  const ctx = buildContextPrompt(state, "Build a detailed launch timeline and milestones")
  const priorData = [
    positioning && `## Positioning\n${positioning.slice(0, 1000)}`,
    channels && `## Channels\n${channels.slice(0, 1000)}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${priorData ? `\n\n--- Strategy Context ---\n${priorData}` : ""}

You are a Launch Planner. Create a detailed, actionable launch timeline.

Deliver:
1. **Launch Strategy**: Soft launch vs big launch vs phased rollout — recommendation with rationale
2. **Pre-Launch Timeline (T-90 to T-0)**:
   - T-90 days: Infrastructure, beta setup, early access list building
   - T-60 days: Beta testing, content creation, press outreach prep
   - T-30 days: Community building, influencer outreach, landing page
   - T-14 days: Final testing, press embargo, Product Hunt scheduling
   - T-7 days: Email sequences ready, social scheduled, team briefed
   - T-0: Launch day checklist
3. **Launch Day Playbook**:
   - Hour-by-hour schedule for launch day
   - Who posts what and when
   - How to handle inbound interest
4. **Post-Launch (Week 1-4)**:
   - Daily actions for first week
   - Weekly actions for first month
5. **Success Metrics**: Targets for Day 1, Week 1, Month 1, Month 3
6. **Contingency Plans**: What to do if launch underperforms
7. **Budget Plan**: Recommended launch budget breakdown

Format as a detailed timeline with specific dates/milestones and actionable tasks.`
}

export async function launchTimelineNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "launch_timeline",
    agentLabel: "Launch Planner",
    taskDescription: `Building launch timeline for ${state.projectData.name}`,
    taskType: "formatting",
    prompt: buildLaunchTimelinePrompt(state),
  })
}
