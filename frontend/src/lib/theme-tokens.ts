/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   LaunchPadAI Theme Tokens                  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Single source of truth for the brand palette.              ║
 * ║                                                             ║
 * ║  HOW TO CHANGE THE THEME:                                   ║
 * ║                                                             ║
 * ║  1. Brand palette (CSS variables):                          ║
 * ║     → Edit --brand-50 through --brand-950 in globals.css    ║
 * ║       These control `bg-brand-*`, `text-brand-*`, etc.      ║
 * ║       Also controls --primary and --ring via `var()`        ║
 * ║                                                             ║
 * ║  2. Accent Tailwind classes (emerald-*, teal-*):            ║
 * ║     → Search-replace across /src for the accent color name  ║
 * ║       e.g. replace "emerald" → "blue", "teal" → "indigo"   ║
 * ║       These are used in buttons, badges, highlights.        ║
 * ║                                                             ║
 * ║  3. Semantic surfaces (light/dark):                         ║
 * ║     → Edit CSS variables in globals.css under               ║
 * ║       .light { } and .dark { } sections                    ║
 * ║       These control bg-background, bg-card, border-border   ║
 * ║                                                             ║
 * ║  4. Phase-specific colors:                                  ║
 * ║     → Edit PHASE_META in PhasePage.tsx                      ║
 * ║     → Edit JOURNEY_STEPS in JourneyRail.tsx                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const brand = {
  50:  "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
  950: "#022c22",
} as const;

export const accent = {
  light: "#14b8a6",
  DEFAULT: "#10b981",
  dark: "#059669",
} as const;

export const phaseColors = {
  discovery:      "#06b6d4",
  validation:     "#f59e0b",
  prd:            "#3b82f6",
  coding_context: "#22c55e",
  gtm:            "#a855f7",
} as const;

export type PhaseType = keyof typeof phaseColors;

/**
 * CSS class fragments for common brand patterns.
 * Import and spread into className when needed.
 */
export const tw = {
  brandGradient: "from-emerald-500 via-teal-500 to-cyan-600",
  brandGradientText: "from-emerald-400 via-teal-400 to-cyan-400",
  brandIconBg: "from-emerald-500 via-teal-500 to-cyan-600",
  accentButton: "bg-emerald-600 hover:bg-emerald-500",
  accentText: "text-emerald-400",
  accentBorder: "border-emerald-500",
  accentRing: "ring-emerald-500",
  accentFocusBorder: "focus:border-emerald-500 focus:ring-emerald-500",
} as const;
