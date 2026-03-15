import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildContentStrategyPrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const positioning = r.positioning_analysis?.content || ""
  const channels = r.channel_research?.content || ""
  const ctx = buildContextPrompt(state, "Create content strategy and messaging frameworks")
  const priorData = [
    positioning && `## Positioning\n${positioning}`,
    channels && `## Channel Strategy\n${channels}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${priorData ? `\n\n--- Strategy Context ---\n${priorData}` : ""}

You are a Content Strategist. Create a comprehensive content marketing strategy.

Deliver:
1. **Content Pillars**: 3-4 core content themes aligned with the positioning
2. **Content Calendar (First 90 Days)**:
   - Week-by-week content plan
   - Mix of: blog posts, social posts, videos, case studies
3. **Blog Content Plan** (10 article ideas with):
   - Title, target keyword, content brief, call-to-action
4. **Social Media Content** (platform-specific):
   - LinkedIn: 5 post ideas
   - Twitter/X: 5 tweet threads ideas
   - Other relevant platforms: 5 ideas each
5. **Email Sequences**:
   - Welcome sequence (5 emails with subject lines and key message)
   - Nurture sequence (3 emails)
6. **Landing Page Copy**:
   - Hero headline + subheadline
   - 3 feature/benefit sections
   - Social proof section suggestions
   - CTA copy
7. **Launch Content**: Product Hunt listing copy (tagline, description, first comment)
8. **SEO Keyword Strategy**: 15-20 target keywords with monthly search volume estimates

Format as a detailed content marketing playbook.`
}

export async function contentStrategyNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "content_strategy",
    agentLabel: "Content Strategist",
    taskDescription: `Creating content strategy for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt: buildContentStrategyPrompt(state),
  })
}
