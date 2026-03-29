/**
 * Landing page theme definitions.
 *
 * Each theme provides a complete design language: color palette, typography,
 * visual effects (CSS), section layout, and personality. The CopyWriter picks
 * a theme that best matches the product category and target audience;
 * the PageBuilder uses it to produce a visually unique page.
 */

export interface LandingTheme {
  /** Machine-readable theme id */
  id: string
  /** Human-readable label */
  label: string
  /** When to use this theme */
  bestFor: string
  /** Color tokens */
  colors: {
    bg: string
    bgSecondary: string
    text: string
    textMuted: string
    accent: string
    accentSecondary: string
    cardBg: string
    cardBorder: string
  }
  /** Google Fonts CDN import URL */
  fontImport: string
  /** CSS font-family declarations */
  fonts: {
    display: string
    body: string
  }
  /** Extra <style> block injected into <head> — CSS custom properties, keyframes, textures */
  customCSS: string
  /** Tailwind classes for the hero background wrapper */
  heroBgClasses: string
  /** Tailwind classes for primary CTA button */
  ctaClasses: string
  /** Tailwind classes for cards / feature boxes */
  cardClasses: string
  /** Section types to include (ordered) */
  sections: string[]
  /** Design personality note fed to the LLM */
  personality: string
}

const THEMES: LandingTheme[] = [
  // ─── 1. Midnight Aurora ─────────────────────────────────────────────
  {
    id: "midnight-aurora",
    label: "Midnight Aurora",
    bestFor: "Developer tools, AI products, API platforms, technical SaaS",
    colors: {
      bg: "#0a0a0f",
      bgSecondary: "#111118",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      accent: "#818cf8",
      accentSecondary: "#c084fc",
      cardBg: "rgba(255,255,255,0.03)",
      cardBorder: "rgba(255,255,255,0.06)",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap",
    fonts: {
      display: "'Playfair Display', serif",
      body: "'Inter', system-ui, sans-serif",
    },
    customCSS: `
      .aurora-bg { position: relative; overflow: hidden; }
      .aurora-bg::before, .aurora-bg::after {
        content: ''; position: absolute; border-radius: 50%;
        filter: blur(120px); opacity: 0.15; animation: aurora-drift 12s ease-in-out infinite alternate;
      }
      .aurora-bg::before { width: 600px; height: 600px; background: #818cf8; top: -200px; left: -100px; }
      .aurora-bg::after { width: 500px; height: 500px; background: #c084fc; bottom: -150px; right: -100px; animation-delay: -6s; }
      @keyframes aurora-drift {
        0% { transform: translate(0, 0) scale(1); }
        100% { transform: translate(60px, -40px) scale(1.1); }
      }
      .grain-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; opacity: 0.025; }
      .gradient-text { background: linear-gradient(135deg, #818cf8, #c084fc, #f0abfc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .glow-sm { box-shadow: 0 0 20px rgba(129,140,248,0.15); }
      .glow-lg { box-shadow: 0 0 40px rgba(129,140,248,0.2), 0 0 80px rgba(192,132,252,0.1); }
      .card-glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); }
    `,
    heroBgClasses: "aurora-bg",
    ctaClasses:
      "bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-8 py-4 rounded-xl glow-sm hover:glow-lg transition-all duration-300 hover:scale-[1.02]",
    cardClasses:
      "card-glass rounded-2xl p-8 hover:-translate-y-1 transition-all duration-300",
    sections: [
      "hero",
      "logo-cloud",
      "problem",
      "solution",
      "bento-features",
      "stats",
      "testimonials",
      "faq",
      "final-cta",
    ],
    personality:
      "Luxurious dark theme with soft aurora glows. Generous whitespace (py-28 between sections). Large display serif headlines (text-6xl+). Subtle animated floating orbs in the background. Glass-morphism cards. Everything feels premium and spacious.",
  },

  // ─── 2. Clean Minimal ──────────────────────────────────────────────
  {
    id: "clean-minimal",
    label: "Clean Minimal",
    bestFor: "Productivity tools, project management, note-taking apps, B2B SaaS",
    colors: {
      bg: "#ffffff",
      bgSecondary: "#f8fafc",
      text: "#0f172a",
      textMuted: "#64748b",
      accent: "#2563eb",
      accentSecondary: "#3b82f6",
      cardBg: "#ffffff",
      cardBorder: "#e2e8f0",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
    fonts: {
      display: "'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
    },
    customCSS: `
      .accent-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #2563eb; margin-right: 8px; }
      .subtle-grid { background-image: radial-gradient(circle, #e2e8f0 1px, transparent 1px); background-size: 24px 24px; }
      .link-underline { text-decoration: underline; text-decoration-color: #2563eb; text-underline-offset: 4px; text-decoration-thickness: 2px; }
    `,
    heroBgClasses: "",
    ctaClasses:
      "bg-slate-900 text-white font-semibold px-8 py-4 rounded-lg hover:bg-slate-800 transition-colors duration-200",
    cardClasses:
      "bg-white border border-slate-200 rounded-xl p-8 hover:border-slate-300 hover:shadow-md transition-all duration-200",
    sections: [
      "hero",
      "logo-cloud",
      "alternating-features",
      "stats",
      "comparison",
      "testimonials",
      "faq",
      "final-cta",
    ],
    personality:
      "Ultra-clean, lots of whitespace (60%+ of layout is negative space). No gradients, no glow — clarity through restraint. Thin 1px borders. Section padding py-24. Headlines are tight-tracked font-black text-5xl in slate-900. A single blue accent color used sparingly on CTAs and links. The design says 'we take this seriously'.",
  },

  // ─── 3. Neon Cyber ──────────────────────────────────────────────────
  {
    id: "neon-cyber",
    label: "Neon Cyber",
    bestFor: "Gaming, crypto, web3, cybersecurity, real-time analytics, trading platforms",
    colors: {
      bg: "#09090b",
      bgSecondary: "#18181b",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      accent: "#22d3ee",
      accentSecondary: "#f472b6",
      cardBg: "rgba(24,24,27,0.8)",
      cardBorder: "rgba(34,211,238,0.15)",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
    fonts: {
      display: "'Space Grotesk', sans-serif",
      body: "'Space Grotesk', sans-serif",
    },
    customCSS: `
      .neon-glow-cyan { box-shadow: 0 0 20px rgba(34,211,238,0.3), 0 0 60px rgba(34,211,238,0.1); }
      .neon-glow-pink { box-shadow: 0 0 20px rgba(244,114,182,0.3), 0 0 60px rgba(244,114,182,0.1); }
      .neon-border { border: 1px solid rgba(34,211,238,0.2); }
      .neon-text { color: #22d3ee; text-shadow: 0 0 10px rgba(34,211,238,0.5); }
      .scanline { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;
        background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px); }
      .grid-bg { background-image: linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px);
        background-size: 60px 60px; }
      .tag { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #22d3ee; }
    `,
    heroBgClasses: "grid-bg",
    ctaClasses:
      "bg-cyan-400 text-zinc-950 font-bold px-8 py-4 rounded-lg neon-glow-cyan hover:bg-cyan-300 transition-all duration-200 uppercase tracking-wider text-sm",
    cardClasses:
      "bg-zinc-900/80 neon-border rounded-xl p-8 hover:neon-glow-cyan transition-all duration-300",
    sections: [
      "hero",
      "stats",
      "bento-features",
      "comparison",
      "testimonials",
      "final-cta",
    ],
    personality:
      "Cyberpunk energy. Grid background pattern. Monospaced section labels in uppercase with letter-spacing. Cyan neon glow on CTAs and card hovers. Sharp geometric shapes. Data-driven layout with metrics and numbers. Section labels use a `// FEATURES` code-comment style. The design screams speed and precision.",
  },

  // ─── 4. Warm Gradient ──────────────────────────────────────────────
  {
    id: "warm-gradient",
    label: "Warm Gradient",
    bestFor: "Consumer apps, social platforms, creative tools, marketplaces, health/wellness",
    colors: {
      bg: "#fffbf5",
      bgSecondary: "#fff7ed",
      text: "#1c1917",
      textMuted: "#78716c",
      accent: "#f97316",
      accentSecondary: "#ec4899",
      cardBg: "#ffffff",
      cardBorder: "rgba(249,115,22,0.1)",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap",
    fonts: {
      display: "'DM Sans', sans-serif",
      body: "'DM Sans', sans-serif",
    },
    customCSS: `
      .warm-gradient-text { background: linear-gradient(135deg, #f97316, #ec4899, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .warm-blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.2; }
      .warm-blob-1 { width: 400px; height: 400px; background: #f97316; top: -100px; right: -100px; }
      .warm-blob-2 { width: 350px; height: 350px; background: #ec4899; bottom: -100px; left: -100px; }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
      .warm-card { background: white; border-radius: 1.25rem; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03); transition: all 0.3s; }
      .warm-card:hover { box-shadow: 0 4px 16px rgba(249,115,22,0.12); transform: translateY(-2px); }
    `,
    heroBgClasses: "relative overflow-hidden",
    ctaClasses:
      "bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold px-8 py-4 rounded-full hover:shadow-lg hover:shadow-orange-500/25 transition-all duration-300 hover:scale-[1.02]",
    cardClasses: "warm-card",
    sections: [
      "hero",
      "logo-cloud",
      "problem",
      "alternating-features",
      "stats",
      "testimonials",
      "pricing-teaser",
      "faq",
      "final-cta",
    ],
    personality:
      "Friendly, approachable, warm. Rounded everything (rounded-full buttons, rounded-2xl cards). Gradient blob decorations floating in backgrounds. Orange-to-pink gradient on headlines and CTAs. Light cream/warm-white backgrounds. Sections feel inviting with generous rounded cards and soft shadows. The design says 'anyone can use this'.",
  },

  // ─── 5. Neobrutalist ──────────────────────────────────────────────
  {
    id: "neobrutalist",
    label: "Neobrutalist",
    bestFor: "Indie products, developer tools, marketplaces, bold startups, newsletter products",
    colors: {
      bg: "#fef9c3",
      bgSecondary: "#fef08a",
      text: "#0a0a0a",
      textMuted: "#404040",
      accent: "#0a0a0a",
      accentSecondary: "#f43f5e",
      cardBg: "#ffffff",
      cardBorder: "#0a0a0a",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    fonts: {
      display: "'Space Grotesk', sans-serif",
      body: "'Space Grotesk', sans-serif",
    },
    customCSS: `
      .brutal-border { border: 3px solid #0a0a0a; }
      .brutal-shadow { box-shadow: 6px 6px 0px #0a0a0a; }
      .brutal-shadow-sm { box-shadow: 4px 4px 0px #0a0a0a; }
      .brutal-hover { transition: all 0.15s ease; }
      .brutal-hover:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0px #0a0a0a; }
      .highlight { background: #fde047; padding: 2px 8px; display: inline; }
      .rose-accent { color: #f43f5e; }
    `,
    heroBgClasses: "",
    ctaClasses:
      "bg-black text-yellow-300 font-bold px-8 py-4 brutal-border brutal-shadow brutal-hover uppercase tracking-wider",
    cardClasses:
      "bg-white brutal-border brutal-shadow-sm p-8 brutal-hover",
    sections: [
      "hero",
      "problem",
      "bento-features",
      "stats",
      "comparison",
      "final-cta",
    ],
    personality:
      "Bold, raw, confident. No border-radius anywhere (sharp corners). Thick 3px black borders with hard offset box-shadows (6px 6px 0 black). Yellow background with black text. Rose-500 used as a highlight color. Headlines are massive (text-7xl) and bold. Intentionally asymmetric layouts. Random rotation on some elements (rotate-1, -rotate-2). The design says 'we don't follow rules, we ship'.",
  },

  // ─── 6. Glass Elegance ─────────────────────────────────────────────
  {
    id: "glass-elegance",
    label: "Glass Elegance",
    bestFor: "Fintech, premium SaaS, analytics dashboards, enterprise AI, design tools",
    colors: {
      bg: "#0c0a1d",
      bgSecondary: "#110e27",
      text: "#eef2ff",
      textMuted: "#a5b4fc",
      accent: "#818cf8",
      accentSecondary: "#e879f9",
      cardBg: "rgba(255,255,255,0.04)",
      cardBorder: "rgba(255,255,255,0.08)",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
    fonts: {
      display: "'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
    },
    customCSS: `
      .glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); }
      .glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.12); }
      .mesh-bg { background:
        radial-gradient(ellipse at 20% 50%, rgba(129,140,248,0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(232,121,249,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, rgba(99,102,241,0.06) 0%, transparent 50%); }
      .gradient-border { position: relative; }
      .gradient-border::before { content: ''; position: absolute; inset: 0; padding: 1px; border-radius: inherit; background: linear-gradient(135deg, rgba(129,140,248,0.3), rgba(232,121,249,0.3), rgba(129,140,248,0.1)); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
      .float-1 { animation: float-1 8s ease-in-out infinite; }
      .float-2 { animation: float-1 8s ease-in-out infinite reverse; }
      @keyframes float-1 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
    `,
    heroBgClasses: "mesh-bg",
    ctaClasses:
      "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold px-8 py-4 rounded-2xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 hover:scale-[1.02]",
    cardClasses:
      "glass rounded-2xl p-8 gradient-border hover:-translate-y-1 transition-all duration-300",
    sections: [
      "hero",
      "logo-cloud",
      "bento-features",
      "stats",
      "alternating-features",
      "testimonials",
      "faq",
      "final-cta",
    ],
    personality:
      "Layered depth and frosted glass everywhere. Mesh gradient backgrounds with subtle colored orbs. Glass cards with gradient borders. Light font weights for body (font-light, 300) with strong headlines (font-extrabold). Indigo-to-fuchsia color palette. Everything floats slightly. The design whispers 'premium'. Use Inter at various weights for sophisticated typography hierarchy.",
  },

  // ─── 7. Retro Warm ────────────────────────────────────────────────
  {
    id: "retro-warm",
    label: "Retro Warm",
    bestFor: "Creative tools, writing apps, education platforms, community products, food/lifestyle",
    colors: {
      bg: "#fdf6e3",
      bgSecondary: "#fef3c7",
      text: "#292524",
      textMuted: "#78716c",
      accent: "#0d9488",
      accentSecondary: "#dc2626",
      cardBg: "#fffbeb",
      cardBorder: "#d6d3d1",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;600;700;800&family=Source+Sans+3:wght@400;500;600&display=swap",
    fonts: {
      display: "'Roboto Slab', serif",
      body: "'Source Sans 3', sans-serif",
    },
    customCSS: `
      .paper-texture { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); }
      .retro-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border: 2px solid #292524; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; }
      .retro-underline { border-bottom: 3px solid #0d9488; padding-bottom: 4px; }
      .squiggle { text-decoration: underline wavy #dc2626; text-underline-offset: 6px; }
    `,
    heroBgClasses: "paper-texture",
    ctaClasses:
      "bg-teal-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-teal-700 transition-colors duration-200 shadow-md",
    cardClasses:
      "bg-amber-50 border-2 border-stone-300 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all duration-200",
    sections: [
      "hero",
      "problem",
      "solution",
      "alternating-features",
      "stats",
      "testimonials",
      "faq",
      "final-cta",
    ],
    personality:
      "Warm and nostalgic with a modern twist. Cream/paper backgrounds with subtle grain texture. Slab-serif headlines give authority. Teal accent for trust, red for emphasis/highlights. Rounded cards with visible borders. Illustrations and decorative elements welcome. The design feels like a well-designed magazine — approachable and thoughtful.",
  },

  // ─── 8. Gradient Mesh ─────────────────────────────────────────────
  {
    id: "gradient-mesh",
    label: "Gradient Mesh",
    bestFor: "Design tools, social media tools, marketing platforms, AI art, creative SaaS",
    colors: {
      bg: "#0f0f0f",
      bgSecondary: "#171717",
      text: "#fafafa",
      textMuted: "#a3a3a3",
      accent: "#f472b6",
      accentSecondary: "#38bdf8",
      cardBg: "rgba(255,255,255,0.04)",
      cardBorder: "rgba(255,255,255,0.06)",
    },
    fontImport:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
    fonts: {
      display: "'Plus Jakarta Sans', sans-serif",
      body: "'Plus Jakarta Sans', sans-serif",
    },
    customCSS: `
      .mesh-hero {
        background:
          radial-gradient(ellipse at 10% 20%, rgba(244,114,182,0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 90% 80%, rgba(56,189,248,0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.1) 0%, transparent 40%);
      }
      .gradient-shift {
        background: linear-gradient(270deg, #f472b6, #38bdf8, #a855f7, #f472b6);
        background-size: 300% 300%;
        animation: gradient-shift 8s ease infinite;
      }
      @keyframes gradient-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .gradient-text-vivid { background: linear-gradient(135deg, #f472b6, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .animated-border { position: relative; border-radius: 1rem; overflow: hidden; }
      .animated-border::before { content: ''; position: absolute; inset: -1px; border-radius: inherit; background: linear-gradient(270deg, #f472b6, #38bdf8, #a855f7); background-size: 300% 300%; animation: gradient-shift 6s ease infinite; z-index: -1; }
      .animated-border > * { border-radius: inherit; }
    `,
    heroBgClasses: "mesh-hero",
    ctaClasses:
      "gradient-shift text-white font-bold px-8 py-4 rounded-full hover:shadow-lg hover:shadow-pink-500/20 transition-all duration-300 hover:scale-[1.02]",
    cardClasses:
      "bg-neutral-900/60 border border-white/[0.06] rounded-2xl p-8 hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-0.5",
    sections: [
      "hero",
      "bento-features",
      "stats",
      "alternating-features",
      "testimonials",
      "logo-cloud",
      "final-cta",
    ],
    personality:
      "Vivid, colorful, dynamic. Multi-color mesh gradient backgrounds that shift slowly. Pink-to-sky blue color palette with purple accents. Animated gradient borders on key cards. Large bold headlines with gradient text. The design feels alive and creative — every section has a slightly different color mood.",
  },
]

export function getAllThemes(): LandingTheme[] {
  return THEMES
}

export function getThemeById(id: string): LandingTheme | undefined {
  return THEMES.find((t) => t.id === id)
}

export function getThemeSummariesForPrompt(): string {
  return THEMES.map(
    (t) => `- **${t.id}** ("${t.label}"): ${t.bestFor}`
  ).join("\n")
}

export function getThemeDesignBrief(theme: LandingTheme): string {
  return `
## Design Theme: ${theme.label} (${theme.id})

### Color Palette
- Background: ${theme.colors.bg}
- Secondary BG: ${theme.colors.bgSecondary}
- Text: ${theme.colors.text}
- Muted text: ${theme.colors.textMuted}
- Accent: ${theme.colors.accent}
- Accent secondary: ${theme.colors.accentSecondary}
- Card BG: ${theme.colors.cardBg}
- Card border: ${theme.colors.cardBorder}

### Typography
- Display font: ${theme.fonts.display}
- Body font: ${theme.fonts.body}
- Font CDN: ${theme.fontImport}

### CTA Button Classes
${theme.ctaClasses}

### Card Classes
${theme.cardClasses}

### Sections to include (in this order)
${theme.sections.map((s, i) => `${i + 1}. ${s}`).join("\n")}

### Design Personality
${theme.personality}

### Custom CSS (inject in <style> block)
\`\`\`css
${theme.customCSS}
\`\`\`

### Hero wrapper class
${theme.heroBgClasses}
`
}
