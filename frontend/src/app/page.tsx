"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  Lightbulb,
  FileText,
  Code2,
  Rocket,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Bot,
  Cpu,
  RefreshCcw,
  ThumbsUp,
  Sparkles,
  Globe,
  Search,
  Play,
  ChevronRight,
  Star,
  ArrowUpRight,
  Layers,
  Brain,
  Target,
  Wand2,
  Menu,
  X,
} from "lucide-react";

/* ── Brand Logo ── */
function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "md" ? "h-8 w-8" : "h-7 w-7";
  const icon = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const text = size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-sm";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${dim} items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25`}>
        <Rocket className={`${icon} text-white -rotate-45`} />
      </div>
      <span className={`${text} font-bold text-white`}>
        LaunchPad<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI</span>
      </span>
    </div>
  );
}

/* ── Animation variants ── */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};

function FadeInSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className={className}>
      {children}
    </motion.div>
  );
}

function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}

/* ── Glass Card Component ── */
function GlassCard({
  children,
  className = "",
  hover = true,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: string;
}) {
  return (
    <div
      className={`
        relative rounded-2xl border border-white/[0.08]
        bg-gradient-to-br from-white/[0.06] to-white/[0.02]
        backdrop-blur-xl shadow-xl shadow-black/10
        ${hover ? "transition-all duration-300 hover:border-white/[0.14] hover:shadow-2xl hover:-translate-y-1 hover:bg-white/[0.07]" : ""}
        ${className}
      `}
    >
      {glow && (
        <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br ${glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl`} />
      )}
      {children}
    </div>
  );
}

/* ── Data ── */
const phases = [
  {
    icon: Search,
    title: "Discovery",
    agents: ["Trend Scanner", "Problem Validator", "Assumption Challenger", "Opportunity Mapper"],
    description: "AI agents scan trends, validate problems, challenge assumptions, and map the opportunity landscape.",
    gradient: "from-rose-500 to-orange-500",
    bg: "from-rose-500/20 to-orange-500/10",
    iconBg: "from-rose-500 to-orange-400",
  },
  {
    icon: Lightbulb,
    title: "Idea Validation",
    agents: ["Market Research Analyst", "Feasibility Analyst", "Persona Researcher", "Synthesizer"],
    description: "Deep-dive into market size, competitive landscape, and user personas for data-driven decisions.",
    gradient: "from-amber-500 to-yellow-500",
    bg: "from-amber-500/20 to-yellow-500/10",
    iconBg: "from-amber-500 to-yellow-400",
  },
  {
    icon: FileText,
    title: "PRD Generation",
    agents: ["Requirements Analyst", "Feature Prioritizer", "UX Flow Designer", "PRD Writer"],
    description: "Auto-generate a complete Product Requirements Document with features, flows, and acceptance criteria.",
    gradient: "from-blue-500 to-cyan-500",
    bg: "from-blue-500/20 to-cyan-500/10",
    iconBg: "from-blue-500 to-cyan-400",
  },
  {
    icon: Code2,
    title: "Coding Context",
    agents: ["System Architect", "Schema Designer", "Task Decomposer", "Context Packager"],
    description: "Export architecture, database schemas, developer tasks, and AI-coding-assistant context files.",
    gradient: "from-emerald-500 to-green-500",
    bg: "from-emerald-500/20 to-green-500/10",
    iconBg: "from-emerald-500 to-green-400",
  },
  {
    icon: Rocket,
    title: "Go-to-Market",
    agents: ["Positioning Strategist", "Channel Strategist", "Content Creator", "Launch Planner"],
    description: "Get positioning, channel strategy, content plans, email sequences, and a complete launch playbook.",
    gradient: "from-violet-500 to-purple-500",
    bg: "from-violet-500/20 to-purple-500/10",
    iconBg: "from-violet-500 to-purple-400",
  },
];

const features = [
  { icon: Cpu, title: "20+ AI Agents", description: "Five specialized crews with deep domain expertise across the entire product lifecycle.", color: "text-teal-400", bg: "from-teal-500/20 to-emerald-500/10" },
  { icon: RefreshCcw, title: "Draft → Refine Loop", description: "Multi-turn refinement lets you give per-section feedback until every detail is perfect.", color: "text-violet-400", bg: "from-violet-500/20 to-purple-500/10" },
  { icon: MessageSquare, title: "AI Co-Founder Chat", description: "Talk naturally. No forms — just conversations that trigger the right agents at the right time.", color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/10" },
  { icon: Zap, title: "Cross-Phase RAG", description: "pgvector semantic search ensures every phase builds on insights from all previous ones.", color: "text-amber-400", bg: "from-amber-500/20 to-orange-500/10" },
  { icon: Shield, title: "Production Artifacts", description: "Deployable PRDs, architecture docs, .cursorrules, task lists, and launch plans.", color: "text-emerald-400", bg: "from-emerald-500/20 to-green-500/10" },
  { icon: ThumbsUp, title: "Human-in-the-Loop", description: "Inline feedback controls per section. Thumbs up/down, comments, and targeted agent reruns.", color: "text-pink-400", bg: "from-pink-500/20 to-rose-500/10" },
  { icon: BarChart3, title: "Validation Scores", description: "Data-driven go/no-go decisions backed by market, feasibility, and user-need analysis.", color: "text-cyan-400", bg: "from-cyan-500/20 to-blue-500/10" },
  { icon: Globe, title: "Real-Time Activity", description: "Watch agents work live via WebSocket streaming. See progress, thoughts, and outputs instantly.", color: "text-orange-400", bg: "from-orange-500/20 to-amber-500/10" },
];

const stats = [
  { value: "20+", label: "AI Agents", icon: Bot, color: "from-teal-400 to-emerald-400" },
  { value: "5", label: "Phases", icon: Layers, color: "from-violet-400 to-purple-400" },
  { value: "30+", label: "Artifacts", icon: FileText, color: "from-blue-400 to-cyan-400" },
  { value: "∞", label: "Refinements", icon: RefreshCcw, color: "from-amber-400 to-orange-400" },
];

const showcaseCards = [
  {
    title: "Market Analysis",
    subtitle: "Validation Phase",
    gradient: "from-emerald-500/30 via-teal-500/20 to-cyan-500/10",
    border: "border-emerald-500/20",
    items: ["TAM: $4.2B by 2027", "3 direct competitors", "Clear differentiation found", "Go/No-Go: Strong Yes"],
    icon: BarChart3,
    iconColor: "text-emerald-400",
  },
  {
    title: "PRD Document",
    subtitle: "Requirements Phase",
    gradient: "from-blue-500/30 via-indigo-500/20 to-violet-500/10",
    border: "border-blue-500/20",
    items: ["12 user stories", "MoSCoW prioritization", "Acceptance criteria", "UX flow diagrams"],
    icon: FileText,
    iconColor: "text-blue-400",
  },
  {
    title: "Launch Playbook",
    subtitle: "GTM Phase",
    gradient: "from-violet-500/30 via-purple-500/20 to-pink-500/10",
    border: "border-violet-500/20",
    items: ["Channel strategy", "Content calendar", "Email sequences", "KPI dashboard"],
    icon: Rocket,
    iconColor: "text-violet-400",
  },
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="dark min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      {/* ═══ Animated Background ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main aurora gradient */}
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[800px] rounded-full bg-gradient-to-br from-teal-600/15 via-emerald-500/10 to-transparent blur-[120px] animate-float-slow" />
        <div className="absolute top-[10%] right-[-10%] h-[500px] w-[600px] rounded-full bg-gradient-to-bl from-violet-600/12 via-purple-500/8 to-transparent blur-[120px] animate-float-slower" />
        <div className="absolute bottom-[-10%] left-[20%] h-[400px] w-[500px] rounded-full bg-gradient-to-tr from-blue-600/10 via-cyan-500/8 to-transparent blur-[100px] animate-float-slow" />
        <div className="absolute top-[50%] right-[10%] h-[350px] w-[350px] rounded-full bg-gradient-to-bl from-rose-500/8 via-pink-500/5 to-transparent blur-[100px] animate-float-slower" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ═══ Navigation ═══ */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl px-5 py-3">
            <Link href="/">
              <BrandLogo />
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {["Phases", "Features", "How It Works", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                  className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                >
                  {item}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="hidden sm:inline-flex text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2">
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300"
              >
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                className="md:hidden p-2 text-zinc-400 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 rounded-2xl border border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-2xl p-4 md:hidden"
            >
              {["Phases", "Features", "How It Works", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                  className="block rounded-xl px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item}
                </a>
              ))}
              <Link href="/auth/login" className="block rounded-xl px-4 py-3 text-sm text-zinc-400 hover:text-white">
                Sign in
              </Link>
            </motion.div>
          )}
        </div>
      </nav>

      <main className="relative">
        {/* ═══ HERO ═══ */}
        <section className="relative pt-40 pb-20 sm:pt-48 sm:pb-32">
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm px-5 py-2 text-sm font-medium text-zinc-300 mb-8"
              >
                <PulsingDot />
                AI-powered idea-to-launch platform
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08 }}
                className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-[5.5rem] leading-[1.05]"
              >
                From idea to{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                    production
                  </span>
                  <motion.span
                    className="absolute -bottom-2 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  />
                </span>
                <br className="hidden sm:block" />
                <span className="text-zinc-400">with AI agents</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mx-auto mt-8 max-w-2xl text-lg text-zinc-400 leading-relaxed sm:text-xl"
              >
                20+ specialized AI agents guide you through discovery, validation, planning,
                architecture, and launch — with human-in-the-loop refinement at every step.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              >
                <Link
                  href="/auth/signup"
                  className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-teal-500/25 hover:shadow-2xl hover:shadow-teal-500/35 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300"
                >
                  Start Building Free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#phases"
                  className="group inline-flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm px-8 py-4 text-base font-medium text-zinc-300 hover:bg-white/[0.07] hover:border-white/[0.14] hover:text-white transition-all duration-300"
                >
                  <Play className="h-4 w-4 text-emerald-400" />
                  See the Pipeline
                </a>
              </motion.div>
            </div>

            {/* ── Stats Row ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              {stats.map((stat) => (
                <GlassCard key={stat.label} className="p-5 text-center group">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} bg-opacity-20 mb-3`}>
                    <stat.icon className="h-5 w-5 text-white/80" />
                  </div>
                  <div className={`text-3xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 font-medium uppercase tracking-wider">{stat.label}</div>
                </GlassCard>
              ))}
            </motion.div>

            {/* ── Showcase Cards (glass cards like Base44) ── */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="mt-16 grid gap-5 sm:grid-cols-3"
            >
              {showcaseCards.map((card) => (
                <div
                  key={card.title}
                  className={`group relative rounded-2xl border ${card.border} bg-gradient-to-br ${card.gradient} backdrop-blur-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}
                >
                  {/* Subtle shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.1] backdrop-blur-sm">
                        <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{card.title}</div>
                        <div className="text-xs text-zinc-500">{card.subtitle}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {card.items.map((item) => (
                        <div key={item} className="flex items-center gap-2.5 text-sm text-zinc-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══ PHASES / PIPELINE ═══ */}
        <section id="phases" className="relative py-28">
          <div className="relative mx-auto max-w-6xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" /> The Pipeline
                </span>
                <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">
                  Five AI-powered phases
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-zinc-400 text-lg">
                  Each phase runs a crew of specialized agents. Context flows between phases
                  via semantic vector search, so every step builds on the last.
                </p>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 space-y-4">
              {phases.map((phase, i) => (
                <motion.div
                  key={phase.title}
                  variants={fadeUp}
                  className="group"
                >
                  <GlassCard className="p-6 sm:p-8 overflow-hidden">
                    {/* Colored glow on hover */}
                    <div className={`absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-bl ${phase.bg} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex items-center gap-4 sm:w-72 shrink-0">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${phase.iconBg} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                          <phase.icon className="h-7 w-7 text-white" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Phase {i + 1}</div>
                          <h3 className="text-xl font-bold text-white">{phase.title}</h3>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-zinc-400 leading-relaxed text-base">{phase.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {phase.agents.map((agent) => (
                            <span
                              key={agent}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] backdrop-blur-sm px-3 py-1.5 text-xs text-zinc-300 transition-all duration-200 hover:bg-white/[0.08] hover:border-white/[0.12]"
                            >
                              <Bot className="h-3 w-3 text-zinc-500" />
                              {agent}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ═══ REFINEMENT LOOP ═══ */}
        <section className="relative py-28">
          <div className="relative mx-auto max-w-6xl px-6">
            <FadeInSection>
              <motion.div variants={fadeUp}>
                <GlassCard hover={false} className="p-8 sm:p-12 overflow-hidden">
                  {/* Multi-color glow */}
                  <div className="absolute top-0 left-0 h-40 w-40 rounded-full bg-purple-500/15 blur-[80px]" />
                  <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-teal-500/15 blur-[80px]" />

                  <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center">
                    <div className="flex-1">
                      <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-purple-400">
                        <RefreshCcw className="h-3 w-3" /> Human-in-the-Loop
                      </span>
                      <h2 className="mt-6 text-3xl font-bold text-white sm:text-4xl leading-tight">
                        Review, refine,{" "}
                        <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">perfect</span>
                      </h2>
                      <p className="mt-4 text-zinc-400 leading-relaxed text-lg">
                        Every phase enters a review state after agents complete their work.
                        Give per-section feedback and let agents refine until you accept.
                      </p>

                      {/* Flow steps */}
                      <div className="mt-8 flex flex-wrap gap-3">
                        {["Draft", "Review", "Refine", "Accept"].map((step, i) => (
                          <div key={step} className="flex items-center gap-2">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                              i === 3
                                ? "bg-gradient-to-br from-green-500/20 to-emerald-500/10 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/10"
                                : "bg-white/[0.06] text-zinc-300 border border-white/[0.08]"
                            }`}>
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-zinc-300">{step}</span>
                            {i < 3 && <ChevronRight className="h-4 w-4 text-zinc-600 ml-1" />}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:w-80 shrink-0">
                      <div className="space-y-3">
                        {[
                          { icon: ThumbsUp, label: "Per-section feedback", desc: "Rate each artifact section", color: "text-emerald-400", bg: "from-emerald-500/20 to-teal-500/10" },
                          { icon: MessageSquare, label: "Detailed comments", desc: "Add specific revision notes", color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/10" },
                          { icon: RefreshCcw, label: "Targeted reruns", desc: "Agents refine with your context", color: "text-purple-400", bg: "from-purple-500/20 to-pink-500/10" },
                        ].map((item) => (
                          <GlassCard key={item.label} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.bg} ${item.color} shrink-0`}>
                                <item.icon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{item.label}</div>
                                <div className="text-xs text-zinc-500 mt-0.5">{item.desc}</div>
                              </div>
                            </div>
                          </GlassCard>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </FadeInSection>
          </div>
        </section>

        {/* ═══ FEATURES GRID ═══ */}
        <section id="features" className="relative py-28">
          <div className="relative mx-auto max-w-6xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-teal-400">
                  <Zap className="h-3.5 w-3.5" /> Why LaunchPadAI
                </span>
                <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Everything you need to ship</h2>
                <p className="mx-auto mt-5 max-w-2xl text-zinc-400 text-lg">
                  Built for developers and founders who want to go from zero to launch with confidence.
                </p>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp} className="group">
                  <GlassCard className="h-full p-6 overflow-hidden">
                    <div className={`absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-bl ${feature.bg} blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.bg} ${feature.color} transition-transform duration-300 group-hover:scale-110`}>
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                      <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how-it-works" className="relative py-28">
          <div className="relative mx-auto max-w-4xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
                  <Wand2 className="h-3.5 w-3.5" /> How It Works
                </span>
                <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Three steps to launch</h2>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 space-y-5">
              {[
                { step: "01", title: "Describe your idea", desc: "Create a project and talk to your AI co-founder in plain language. No templates, no forms — just a conversation.", gradient: "from-orange-500 to-amber-400", bg: "from-orange-500/20 to-amber-500/10", icon: Brain },
                { step: "02", title: "Review & refine", desc: "20+ specialized agents analyze, research, plan, and create. Review output, give feedback, and refine until it's perfect.", gradient: "from-teal-500 to-blue-400", bg: "from-teal-500/20 to-blue-500/10", icon: Target },
                { step: "03", title: "Ship it", desc: "Export your PRD, architecture docs, task lists, and launch plan. Start coding with full context from day one.", gradient: "from-violet-500 to-pink-400", bg: "from-violet-500/20 to-pink-500/10", icon: Rocket },
              ].map((item) => (
                <motion.div key={item.step} variants={fadeUp} className="group">
                  <GlassCard className="p-6 sm:p-8 overflow-hidden">
                    <div className={`absolute top-0 left-0 h-28 w-28 rounded-full bg-gradient-to-br ${item.bg} blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative flex gap-6 items-start">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} shadow-lg font-bold text-xl text-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
                        <item.icon className="h-7 w-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Step {item.step}</span>
                        </div>
                        <h3 className="mt-1 text-xl font-bold text-white">{item.title}</h3>
                        <p className="mt-2 text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" className="relative py-28">
          <div className="relative mx-auto max-w-5xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Star className="h-3.5 w-3.5" /> Pricing
                </span>
                <h2 className="mt-6 text-4xl font-bold text-white sm:text-5xl">Simple pricing for builders</h2>
                <p className="mt-5 text-zinc-400 text-lg">Start free. Scale when you&apos;re ready.</p>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 grid gap-5 sm:grid-cols-3">
              {/* Free */}
              <motion.div variants={fadeUp} className="group">
                <GlassCard className="h-full p-7">
                  <div className="relative">
                    <h3 className="text-lg font-bold text-white">Free</h3>
                    <p className="mt-1 text-xs text-zinc-500">For trying out LaunchPadAI</p>
                    <div className="mt-5">
                      <span className="text-5xl font-extrabold bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">$0</span>
                      <span className="text-zinc-600 ml-1">/mo</span>
                    </div>
                    <ul className="mt-7 space-y-3">
                      {["1 project", "All 5 AI phases", "Chat with AI co-founder", "Draft-Review-Refine loop", "Community support"].map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                          <CheckCircle2 className="h-4 w-4 text-zinc-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/auth/signup"
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
                    >
                      Get Started Free
                    </Link>
                  </div>
                </GlassCard>
              </motion.div>

              {/* Pro — highlighted */}
              <motion.div variants={fadeUp} className="group">
                <div className="relative h-full rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-emerald-900/10 to-white/[0.02] backdrop-blur-xl p-7 shadow-xl shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/15">
                  <div className="absolute -top-3.5 left-7 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-teal-500/30">
                    Most Popular
                  </div>
                  <h3 className="text-lg font-bold text-white">Pro</h3>
                  <p className="mt-1 text-xs text-zinc-500">For serious builders</p>
                  <div className="mt-5">
                    <span className="text-5xl font-extrabold bg-gradient-to-br from-emerald-300 to-teal-400 bg-clip-text text-transparent">$19</span>
                    <span className="text-zinc-600 ml-1">/mo</span>
                  </div>
                  <ul className="mt-7 space-y-3">
                    {["Up to 5 projects", "All 5 AI phases", "Unlimited refinement loops", "Export all artifacts", "Email support"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/signup"
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300"
                  >
                    Upgrade to Pro <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>

              {/* Team */}
              <motion.div variants={fadeUp} className="group">
                <div className="relative h-full rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-white/[0.02] backdrop-blur-xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/10">
                  <h3 className="text-lg font-bold text-white">Team</h3>
                  <p className="mt-1 text-xs text-zinc-500">For startups & teams</p>
                  <div className="mt-5">
                    <span className="text-5xl font-extrabold bg-gradient-to-br from-violet-300 to-purple-400 bg-clip-text text-transparent">$49</span>
                    <span className="text-zinc-600 ml-1">/mo</span>
                  </div>
                  <ul className="mt-7 space-y-3">
                    {["Unlimited projects", "All 5 AI phases", "Multi-user collaboration", "Priority support", "Export all artifacts", "Custom agent configs"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                        <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/signup"
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-violet-600/10 px-4 py-3 text-sm font-semibold text-violet-300 hover:bg-violet-600/20 hover:text-violet-200 transition-all duration-200"
                  >
                    Upgrade to Team <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </FadeInSection>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="relative py-32">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-gradient-to-br from-emerald-600/15 via-teal-500/10 to-cyan-500/8 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <FadeInSection>
              <motion.div variants={fadeUp}>
                <h2 className="text-4xl font-bold text-white sm:text-6xl leading-tight">
                  Ready to launch your next{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">big idea</span>?
                </h2>
                <p className="mt-6 text-lg text-zinc-400">
                  Join developers and startup teams who use LaunchPadAI
                  to go from concept to launch with confidence.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    href="/auth/signup"
                    className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-10 py-4 text-base font-semibold text-white shadow-xl shadow-teal-500/25 hover:shadow-2xl hover:shadow-teal-500/35 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300"
                  >
                    Start Building Free
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </motion.div>
            </FadeInSection>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandLogo size="sm" />
            <div className="flex items-center gap-6 text-sm text-zinc-600">
              <a href="#phases" className="hover:text-white transition-colors">Phases</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </div>
            <p className="text-xs text-zinc-600">
              &copy; {new Date().getFullYear()} LaunchPadAI. Built with AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
