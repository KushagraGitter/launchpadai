/**
 * PageBuilder node — takes structured copy JSON + theme from CopyWriter and
 * produces a complete, standalone, visually stunning HTML landing page.
 *
 * Uses Tailwind CSS v4 (browser CDN) + Google Fonts + custom CSS from the
 * theme definition. Each theme produces a dramatically different visual style.
 *
 * The generated HTML includes:
 * - Responsive design (mobile-first)
 * - Theme-specific visual effects (aurora, glass, neon, brutalist, etc.)
 * - Email capture forms (POST to /api/landing/{slug}/lead)
 * - Scroll-triggered animations
 * - Proper SEO meta tags & Open Graph
 * - "Powered by LaunchPadAI" footer
 */

import { HumanMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { config } from "../../config"
import * as publisher from "../../redis/publisher"
import { estimateTokens } from "../helpers"
import { getThemeById, getThemeDesignBrief, getAllThemes } from "./themes"
import { logger } from "../../logger"
import type { PhaseStateType } from "../../graphs/state"
import type { NodeResult } from "../../types"

/** Build the icon SVG library string for the prompt */
function getIconLibrary(): string {
  return `
ICON SVG LIBRARY — use these exact SVGs for the icons specified in the copy JSON:

zap: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
shield: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
bar-chart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
clock: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
users: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
globe: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
layers: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
cpu: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
sparkles: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
target: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
rocket: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
code: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
eye: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
lock: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
heart: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
alert-triangle: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
x-circle: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
frown: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
dollar-sign: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
check: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
x: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
chevron-down: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
`
}

function buildPageBuilderPrompt(state: PhaseStateType): string {
  const copyResult = state.nodeResults.copy_writer
  const copyJson = copyResult?.content || "{}"

  // Parse copy JSON to extract theme_id
  let themeId = "midnight-aurora" // default
  try {
    const jsonMatch = copyJson.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      themeId = parsed.theme_id || themeId
    }
  } catch {
    // fallback to default
  }

  const theme = getThemeById(themeId) || getAllThemes()[0]
  const designBrief = getThemeDesignBrief(theme)

  return `You are a world-class frontend developer who builds STUNNING, high-converting SaaS landing pages.
Your pages look like they were built by Vercel's design team — pixel-perfect, modern, and beautiful.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Product: ${state.projectData.name}
Idea: ${state.projectData.rawIdea}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPY JSON (from CopyWriter)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${copyJson}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${designBrief}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICON SVGs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${getIconLibrary()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNICAL REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Self-contained single HTML file**. Use Tailwind CSS v4 browser CDN:
   <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

2. **Google Fonts**: Load via <link> tag: ${theme.fontImport}

3. **Custom CSS**: Include ALL the custom CSS from the design system above in a <style> block.

4. **Body base styles**: Set font-family, background color, and text color on <body> per the theme.

5. **Email capture form** — CRITICAL: Every email form must use this JavaScript:
\`\`\`javascript
document.querySelectorAll('form[data-lead-form]').forEach(form => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Submitting...';
    btn.disabled = true;
    const email = form.querySelector('input[type="email"]').value;
    const name = form.querySelector('input[name="name"]')?.value || null;
    const slug = window.location.pathname.split('/').pop();
    try {
      const res = await fetch('/api/landing/' + slug + '/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });
      const data = await res.json();
      if (data.success) {
        form.innerHTML = '<div class="py-6 text-center"><p class="text-lg font-semibold" style="color: ${theme.colors.accent}">' + data.message + '</p><p class="text-sm mt-2 opacity-60">Check your inbox soon.</p></div>';
      }
    } catch (err) {
      btn.textContent = originalText;
      btn.disabled = false;
      alert('Something went wrong. Please try again.');
    }
  });
});
\`\`\`

6. **Scroll animations**: Add this IntersectionObserver for elements with class "reveal":
\`\`\`javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
\`\`\`
Add this CSS for the reveal animation:
\`\`\`css
.reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
.revealed { opacity: 1; transform: translateY(0); }
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
.reveal-delay-4 { transition-delay: 0.4s; }
\`\`\`

7. **FAQ accordion**: Use <details>/<summary> HTML elements styled with the theme. Add smooth toggle animation.

8. **Meta tags**: Include <title>, <meta description>, Open Graph tags (og:title, og:description, og:type), Twitter card meta.

9. **Footer**: Include a subtle "Built with LaunchPadAI" text with link to https://launchpadai.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN EXCELLENCE GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What separates a "WOW" page from a generic template:

- **WHITESPACE**: Use generous padding (py-24 to py-32 between sections). 60%+ of the layout should be negative space.
- **TYPOGRAPHY CONTRAST**: Display headlines should be 4x larger than body text (text-6xl vs text-base). Use the display font for headlines and body font for everything else.
- **ONE ACCENT COLOR**: Use the accent color sparingly — only on CTAs, key highlights, and icons. Don't overuse it.
- **LAYERED DEPTH**: Use the theme's visual effects to create z-axis depth — overlapping elements, varying shadow intensities, background blurs.
- **MICRO-INTERACTIONS**: Hover states should feel intentional (subtle lift + shadow + scale). Transitions of 200-300ms.
- **ASYMMETRY**: Not every section needs to be centered. Mix left-aligned, centered, and asymmetric layouts.
- **VISUAL RHYTHM**: Alternate between dense sections (bento grid) and spacious ones (single CTA). Never have two dense sections back-to-back.
- **SECTION TRANSITIONS**: Use subtle background color changes between sections to create visual separation.

SECTION-SPECIFIC NOTES:

- **Hero**: Full viewport height (min-h-screen). Massive headline. Email input + CTA as a flex row on desktop.
- **Logo Cloud**: Horizontal row of text logos in muted color, with "Trusted by" label. Optional: infinite marquee scroll animation.
- **Bento Features**: CSS Grid with mixed sizes (one large card spanning 2 cols, rest single). NOT a boring uniform grid.
- **Alternating Features**: Left-right zigzag layout. Each feature has a visual element on one side and text on the other.
- **Stats**: Full-width accent strip. Large numbers (text-5xl+) with labels below. Optional counter animation.
- **Testimonials**: Horizontal card row or masonry-style grid. Initials avatar circles. Quote marks.
- **Comparison**: Two-column table with ✗ (before) and ✓ (after) icons. Clear visual contrast.
- **FAQ**: Accordion with smooth expand animation. Styled <details>/<summary>.
- **Final CTA**: Full-width section with strong visual presence. Large heading + email form.

Return ONLY the complete HTML — no markdown fences, no explanation. Start with <!DOCTYPE html> and end with </html>.
Make it BEAUTIFUL. Make it unique. Make it convert.`
}

export async function pageBuilderNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const nodeName = "page_builder"
  const agentLabel = "Landing Page Builder"
  const taskDescription = `Building landing page for ${state.projectData.name}`

  await publisher.agentStart(state, agentLabel, taskDescription)

  try {
    const llm = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: config.OPENAI_API_KEY,
      temperature: 0.4,
      streaming: true,
      maxTokens: 16000,
    })

    const prompt = buildPageBuilderPrompt(state)
    const stream = await llm.stream([new HumanMessage(prompt)])

    let fullOutput = ""
    let buffer = ""

    for await (const chunk of stream) {
      const token = typeof chunk.content === "string" ? chunk.content : ""
      fullOutput += token
      buffer += token
      if (buffer.length >= 100) {
        await publisher.agentThinking(state, agentLabel, buffer)
        buffer = ""
      }
    }

    if (buffer.length > 0) {
      await publisher.agentThinking(state, agentLabel, buffer)
    }

    // Clean up the HTML — strip any accidental markdown fences
    let html = fullOutput.trim()
    if (html.startsWith("```html")) html = html.slice(7)
    else if (html.startsWith("```")) html = html.slice(3)
    if (html.endsWith("```")) html = html.slice(0, -3)
    html = html.trim()

    // Parse the copy_writer output for metadata
    let copyData: Record<string, unknown> = {}
    let themeId = "midnight-aurora"
    try {
      const copyContent = state.nodeResults.copy_writer?.content || ""
      const jsonMatch = copyContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        copyData = JSON.parse(jsonMatch[0])
        themeId = (copyData.theme_id as string) || themeId
      }
    } catch {
      // ignore parse errors
    }

    const meta = copyData.meta as Record<string, string> | undefined

    await publisher.agentComplete(
      state,
      agentLabel,
      `Landing page built with theme "${themeId}" (${html.length} chars)`
    )

    const result: NodeResult = {
      nodeName,
      agentLabel,
      content: html,
      contentJson: {
        html,
        slug:
          meta?.slug ||
          state.projectData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        page_title: meta?.page_title || state.projectData.name,
        meta_description:
          meta?.meta_description ||
          state.projectData.rawIdea.slice(0, 155),
        template_style: themeId,
      },
      tokensUsed: estimateTokens(fullOutput),
      completedAt: new Date(),
    }

    return { nodeResults: { [nodeName]: result } }
  } catch (err) {
    const errorMsg = String(err)
    logger.error("PageBuilder failed", { error: errorMsg })
    await publisher.agentComplete(
      state,
      agentLabel,
      `ERROR: ${errorMsg}`.slice(0, 500)
    )

    return {
      nodeResults: {
        [nodeName]: {
          nodeName,
          agentLabel,
          content: "",
          contentJson: { error: errorMsg },
          tokensUsed: 0,
          completedAt: new Date(),
          error: errorMsg,
        },
      },
      errors: [errorMsg],
    }
  }
}
