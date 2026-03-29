/**
 * CopyWriter node — generates all landing page copy from validation artifacts.
 *
 * Two responsibilities:
 * 1. Pick the best visual theme for this product (from 8 options)
 * 2. Generate structured copy JSON tailored to that theme's section layout
 */

import { runNode, buildContextPrompt } from "../helpers"
import { getThemeSummariesForPrompt } from "./themes"
import type { PhaseStateType } from "../../graphs/state"

function buildCopyWriterPrompt(state: PhaseStateType): string {
  const ctx = buildContextPrompt(
    state,
    "Generate compelling landing page copy for a waitlist/pre-launch page"
  )

  const themeSummaries = getThemeSummariesForPrompt()

  return `${ctx}

You are an elite SaaS copywriter who has written landing pages for products that generated thousands of waitlist signups. You also have a keen eye for visual design.

Using all the validation research, discovery brief, and project data above, do TWO things:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: PICK THE BEST VISUAL THEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Available themes:
${themeSummaries}

Choose the theme that best matches this product's category, target audience, and personality. A developer tool should feel different from a consumer app. A fintech product should feel different from a creative tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: GENERATE THE COPY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON with this schema — no markdown, no explanation:
{
  "theme_id": "<one of the theme ids above>",
  "hero": {
    "badge": "<short badge text above headline, e.g. 'Now in Beta' or 'AI-Powered'>",
    "headline": "<8-10 words max, punchy, benefit-driven. Make it memorable.>",
    "subheadline": "<1-2 sentences expanding on the headline, 20-30 words>",
    "cta_text": "Join the Waitlist",
    "cta_subtext": "<social proof hint, e.g. 'Join 200+ early adopters'>",
    "secondary_cta_text": "<optional ghost button text, e.g. 'See how it works' or 'Watch demo'>",
  },
  "logo_cloud": {
    "label": "<e.g. 'Built for teams at' or 'Trusted by innovators'>",
    "logos": ["<company/brand name 1>", "<company/brand name 2>", "<company/brand name 3>", "<company/brand name 4>", "<company/brand name 5>"]
  },
  "problem": {
    "badge": "<section label, e.g. 'The Problem'>",
    "heading": "<problem section heading, make it feel the pain>",
    "description": "<2-3 vivid sentences describing the pain point>",
    "pain_points": [
      { "icon": "<one of: alert-triangle, clock, x-circle, frown, dollar-sign, lock>", "title": "<short pain title>", "description": "<1 sentence>" },
      { "icon": "<icon>", "title": "<title>", "description": "<description>" },
      { "icon": "<icon>", "title": "<title>", "description": "<description>" }
    ]
  },
  "solution": {
    "badge": "<section label, e.g. 'The Solution'>",
    "heading": "<how your product solves it — make it feel like relief>",
    "description": "<2-3 sentences on the approach>",
    "key_benefits": ["<benefit 1>", "<benefit 2>", "<benefit 3>"]
  },
  "features": [
    {
      "title": "<feature name>",
      "description": "<2 sentences — what it does and why it matters>",
      "icon": "<one of: zap, shield, bar-chart, clock, users, globe, layers, cpu, sparkles, target, rocket, code, eye, lock, heart>",
      "size": "<'large' for 1-2 hero features, 'normal' for the rest>"
    },
    { "title": "...", "description": "...", "icon": "...", "size": "normal" },
    { "title": "...", "description": "...", "icon": "...", "size": "normal" },
    { "title": "...", "description": "...", "icon": "...", "size": "normal" },
    { "title": "...", "description": "...", "icon": "...", "size": "normal" },
    { "title": "...", "description": "...", "icon": "...", "size": "normal" }
  ],
  "stats": [
    { "number": "<e.g. $4.2B>", "label": "<what it represents>", "description": "<optional 1-sentence context>" },
    { "number": "<e.g. 73%>", "label": "<label>" },
    { "number": "<e.g. 10x>", "label": "<label>" },
    { "number": "<e.g. <2min>", "label": "<label>" }
  ],
  "testimonials": [
    { "quote": "<realistic testimonial, 1-2 sentences>", "name": "<realistic name>", "role": "<title & company>", "avatar_initials": "<2 letters>" },
    { "quote": "...", "name": "...", "role": "...", "avatar_initials": "..." },
    { "quote": "...", "name": "...", "role": "...", "avatar_initials": "..." }
  ],
  "comparison": {
    "heading": "<e.g. 'Old way vs. New way' or 'Why switch?'>",
    "before_label": "<e.g. 'Without ProductName'>",
    "after_label": "<e.g. 'With ProductName'>",
    "items": [
      { "before": "<pain>", "after": "<benefit>" },
      { "before": "<pain>", "after": "<benefit>" },
      { "before": "<pain>", "after": "<benefit>" },
      { "before": "<pain>", "after": "<benefit>" }
    ]
  },
  "faq": [
    { "question": "<common question>", "answer": "<concise answer, 1-3 sentences>" },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ],
  "final_cta": {
    "heading": "<urgency-driven heading>",
    "subheading": "<1-2 sentences, create FOMO or excitement>"
  },
  "meta": {
    "page_title": "<SEO title, 60 chars max>",
    "meta_description": "<SEO description, 155 chars max>",
    "slug": "<url-safe-slug-from-project-name>",
    "og_image_text": "<short text for social sharing card>"
  }
}

IMPORTANT GUIDELINES:
- Make the copy SPECIFIC to this product — never use generic placeholder text
- Testimonials should feel realistic (use common first names, realistic job titles at plausible companies)
- Stats should be grounded in the market research from validation
- Each feature should have a DIFFERENT icon
- FAQ should address real concerns a potential user would have
- The headline is the most important piece — spend extra thought on it
- Write for humans, not bots. Be conversational, not corporate.`
}

export async function copyWriterNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "copy_writer",
    agentLabel: "Landing Page Copywriter",
    taskDescription: `Writing landing page copy for ${state.projectData.name}`,
    taskType: "synthesis",
    prompt: buildCopyWriterPrompt(state),
    useSearch: false,
  })
}
