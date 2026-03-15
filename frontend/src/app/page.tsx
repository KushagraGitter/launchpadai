"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
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
} from "lucide-react";

function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "md" ? "h-8 w-8" : "h-7 w-7";
  const icon = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const text = size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-sm";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${dim} items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600`}>
        <Rocket className={`${icon} text-white -rotate-45`} />
      </div>
      <span className={`${text} font-bold text-white`}>
        LaunchPad<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI</span>
      </span>
    </div>
  );
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] as const } },
};

function FadeInSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
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

const phases = [
  {
    icon: Search,
    title: "Discovery",
    agents: ["Trend Scanner", "Problem Validator", "Assumption Challenger", "Opportunity Mapper"],
    description: "AI agents scan trends, validate problem statements, challenge assumptions, and map the opportunity landscape before you commit.",
    color: "from-rose-500 to-orange-500",
  },
  {
    icon: Lightbulb,
    title: "Idea Validation",
    agents: ["Market Research Analyst", "Feasibility Analyst", "Persona Researcher", "Synthesizer"],
    description: "Deep-dive into market size, competitive landscape, technical feasibility, and user personas — then synthesize a data-driven go/no-go scorecard.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: FileText,
    title: "PRD Generation",
    agents: ["Requirements Analyst", "Feature Prioritizer", "UX Flow Designer", "PRD Writer"],
    description: "Auto-generate a complete Product Requirements Document with MoSCoW features, user flows, and acceptance criteria.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Code2,
    title: "Coding Context",
    agents: ["System Architect", "Schema Designer", "Task Decomposer", "Context Packager"],
    description: "Export system architecture, database schemas, developer tasks, and AI-coding-assistant context files.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Rocket,
    title: "Go-to-Market",
    agents: ["Positioning Strategist", "Channel Strategist", "Content Creator", "Launch Planner"],
    description: "Get positioning, channel strategy, landing page copy, social posts, email sequences, and a launch playbook.",
    color: "from-purple-500 to-pink-500",
  },
];

const features = [
  { icon: Cpu, title: "20+ Specialized AI Agents", description: "Five crews of expert agents with deep domain knowledge across discovery, validation, planning, architecture, and go-to-market." },
  { icon: RefreshCcw, title: "Draft → Review → Refine", description: "Multi-turn refinement loops let you give per-section feedback. Agents incorporate your input and refine until you accept." },
  { icon: MessageSquare, title: "AI Co-Founder Chat", description: "Talk to your AI co-founder naturally. No forms — just a conversation that triggers the right agents." },
  { icon: Zap, title: "Cross-Phase Context (RAG)", description: "pgvector semantic search ensures every phase builds on insights from all previous ones. No context is lost." },
  { icon: Shield, title: "Production-Ready Artifacts", description: "Get deployable PRDs, architecture docs, .cursorrules, task lists, and launch plans — ready for your team." },
  { icon: ThumbsUp, title: "Human-in-the-Loop Review", description: "Inline feedback controls per artifact section. Thumbs up/down, comments, and targeted agent reruns." },
  { icon: BarChart3, title: "Validation Scorecards", description: "Data-driven go/no-go decisions with market, feasibility, and user-need scores backed by real research." },
  { icon: Globe, title: "Real-Time Agent Activity", description: "Watch agents work live via WebSocket streaming. See each agent's progress, thoughts, and outputs in real time." },
];

const stats = [
  { value: "20+", label: "AI Agents" },
  { value: "5", label: "Phases" },
  { value: "30+", label: "Artifacts" },
  { value: "∞", label: "Refinement Loops" },
];

export default function LandingPage() {
  return (
    <div className="dark min-h-screen bg-surface-0 overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-surface-0/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/">
            <BrandLogo />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#phases" className="text-sm text-surface-700 hover:text-white transition-colors">Phases</a>
            <a href="#features" className="text-sm text-surface-700 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-surface-700 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-surface-700 hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-ghost text-surface-800 text-sm">Sign in</Link>
            <Link href="/auth/signup" className="btn-primary text-sm">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="relative pt-36 pb-28 overflow-hidden">
          {/* Background orbs — pure CSS animations, GPU-composited */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-teal-600/12 blur-[100px] will-change-transform animate-float-slow pointer-events-none" />
          <div className="absolute top-40 -left-20 h-[280px] w-[280px] rounded-full bg-emerald-500/8 blur-[80px] will-change-transform animate-float-slower pointer-events-none" />
          <div className="absolute top-60 -right-20 h-[240px] w-[240px] rounded-full bg-cyan-500/8 blur-[80px] will-change-transform animate-float-slow pointer-events-none" />

          {/* Grid — single instance, pure CSS */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

          <div className="relative mx-auto max-w-5xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-surface-800 mb-8"
            >
              <PulsingDot />
              AI-powered idea-to-launch platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl lg:text-8xl leading-[0.95]"
            >
              From idea to{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  production
                </span>
                <motion.span
                  className="absolute -bottom-2 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mx-auto mt-8 max-w-2xl text-lg text-surface-700 leading-relaxed sm:text-xl"
            >
              20+ specialized AI agents guide you through discovery, validation, planning,
              architecture, and launch — with human-in-the-loop refinement at every step.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link href="/auth/signup" className="btn-primary px-8 py-3.5 text-base">
                Start Building Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#phases" className="btn-secondary px-8 py-3.5 text-base">
                See the Pipeline
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-20 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-4 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="text-3xl font-bold bg-gradient-to-br from-white to-surface-700 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-surface-600 font-medium uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Pipeline / Phases ── */}
        <section id="phases" className="relative py-28">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-teal-600/6 blur-[80px] pointer-events-none" />

          <div className="relative mx-auto max-w-6xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="h-3.5 w-3.5" /> The Pipeline
                </span>
                <h2 className="mt-5 text-4xl font-bold text-white sm:text-5xl">Five AI-powered phases</h2>
                <p className="mx-auto mt-5 max-w-2xl text-surface-700 text-lg">
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
                  className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1] hover:-translate-y-0.5"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-4 sm:w-64 shrink-0">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${phase.color} transition-transform duration-200 group-hover:scale-105`}>
                        <phase.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-surface-600 uppercase tracking-[0.15em]">Phase {i + 1}</div>
                        <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-surface-800 leading-relaxed">{phase.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {phase.agents.map((agent) => (
                          <span
                            key={agent}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-surface-800"
                          >
                            <Bot className="h-3 w-3 text-surface-600" />
                            {agent}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ── Refinement Loop Highlight ── */}
        <section className="relative py-28 border-t border-white/[0.06]">
          <div className="absolute top-1/3 right-0 h-[250px] w-[300px] rounded-full bg-purple-500/6 blur-[80px] pointer-events-none" />

          <div className="relative mx-auto max-w-5xl px-6">
            <FadeInSection>
              <motion.div variants={fadeUp} className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 sm:p-12">
                <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
                      <RefreshCcw className="h-3 w-3" /> New
                    </span>
                    <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
                      Human-in-the-loop<br />refinement
                    </h2>
                    <p className="mt-4 text-surface-700 leading-relaxed text-lg">
                      Every phase enters a review state after agents complete their work.
                      Give per-section feedback — thumbs up, thumbs down, or detailed comments.
                      Agents refine based on your input until you accept.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      {["Draft", "Review", "Refine", "Accept"].map((step, i) => (
                        <div key={step} className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            i === 3
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-white/[0.06] text-surface-800 border border-white/[0.08]"
                          }`}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-surface-800">{step}</span>
                          {i < 3 && <ArrowRight className="h-3.5 w-3.5 text-surface-500 ml-1" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:w-80 shrink-0">
                    <div className="space-y-3">
                      {[
                        { icon: ThumbsUp, label: "Per-section feedback", desc: "Rate each artifact section" },
                        { icon: MessageSquare, label: "Detailed comments", desc: "Add specific revision notes" },
                        { icon: RefreshCcw, label: "Targeted reruns", desc: "Agents refine with your context" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-400 shrink-0">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{item.label}</div>
                            <div className="text-xs text-surface-600">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </FadeInSection>
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section id="features" className="relative py-28 border-t border-white/[0.06]">
          <div className="relative mx-auto max-w-6xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Zap className="h-3.5 w-3.5" /> Why LaunchPadAI
                </span>
                <h2 className="mt-5 text-4xl font-bold text-white sm:text-5xl">Everything you need to ship</h2>
                <p className="mx-auto mt-5 max-w-2xl text-surface-700 text-lg">
                  Built for developers and founders who want to go from zero to launch with confidence.
                </p>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={fadeUp}
                  className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1] hover:-translate-y-1"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-teal-600/20 text-emerald-400 transition-colors duration-200 group-hover:from-emerald-600/30 group-hover:to-teal-600/30">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-xs text-surface-700 leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="relative py-28 border-t border-white/[0.06]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-emerald-600/5 blur-[80px] pointer-events-none" />

          <div className="relative mx-auto max-w-4xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Bot className="h-3.5 w-3.5" /> How It Works
                </span>
                <h2 className="mt-5 text-4xl font-bold text-white sm:text-5xl">Three steps to launch</h2>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 space-y-6">
              {[
                { step: "01", title: "Describe your idea", desc: "Create a project and tell your AI co-founder about your idea in plain language. No templates, no forms — just a conversation.", color: "from-orange-500 to-amber-500" },
                { step: "02", title: "Review & refine", desc: "20+ specialized AI agents analyze, research, plan, and create. Review their output, give feedback, and let them refine until it's perfect.", color: "from-teal-500 to-blue-500" },
                { step: "03", title: "Ship it", desc: "Export your PRD, architecture docs, task lists, and launch plan. Start coding with full context from day one.", color: "from-purple-500 to-pink-500" },
              ].map((item) => (
                <motion.div
                  key={item.step}
                  variants={fadeUp}
                  className="flex gap-6 items-start rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 transition-all duration-200 hover:bg-white/[0.04] hover:translate-x-1"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} font-bold text-lg text-white`}>
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-surface-700 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </FadeInSection>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="relative py-28 border-t border-white/[0.06]">
          <div className="absolute top-0 right-1/4 h-[240px] w-[240px] rounded-full bg-emerald-600/6 blur-[80px] pointer-events-none" />

          <div className="relative mx-auto max-w-5xl px-6">
            <FadeInSection className="text-center">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Pricing
                </span>
                <h2 className="mt-5 text-4xl font-bold text-white sm:text-5xl">Simple pricing for builders</h2>
                <p className="mt-5 text-surface-700 text-lg">Start free. Scale when you&apos;re ready.</p>
              </motion.div>
            </FadeInSection>

            <FadeInSection className="mt-16 grid gap-5 sm:grid-cols-3">
              {/* Free */}
              <motion.div
                variants={fadeUp}
                className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 transition-transform duration-200 hover:-translate-y-1"
              >
                <h3 className="text-lg font-bold text-white">Free</h3>
                <p className="mt-1 text-xs text-surface-600">For trying out LaunchPadAI</p>
                <div className="mt-5">
                  <span className="text-5xl font-extrabold text-white">$0</span>
                  <span className="text-surface-600 ml-1">/mo</span>
                </div>
                <ul className="mt-7 space-y-3">
                  {["1 project", "All 5 AI phases", "Chat with AI co-founder", "Draft → Review → Refine loop", "Community support"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="btn-secondary w-full mt-8">Get Started Free</Link>
              </motion.div>

              {/* Pro */}
              <motion.div
                variants={fadeUp}
                className="relative h-full rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/30 to-white/[0.02] p-7 transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-0.5 text-xs font-semibold text-white">Popular</div>
                <h3 className="text-lg font-bold text-white">Pro</h3>
                <p className="mt-1 text-xs text-surface-600">For serious builders</p>
                <div className="mt-5">
                  <span className="text-5xl font-extrabold text-white">$19</span>
                  <span className="text-surface-600 ml-1">/mo</span>
                </div>
                <ul className="mt-7 space-y-3">
                  {["Up to 5 projects", "All 5 AI phases", "Unlimited refinement loops", "Export all artifacts", "Email support"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="btn-primary w-full mt-8">
                  Upgrade to Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              {/* Team */}
              <motion.div
                variants={fadeUp}
                className="h-full rounded-2xl border border-purple-500/20 bg-white/[0.02] p-7 transition-transform duration-200 hover:-translate-y-1"
              >
                <h3 className="text-lg font-bold text-white">Team</h3>
                <p className="mt-1 text-xs text-surface-600">For startups & teams</p>
                <div className="mt-5">
                  <span className="text-5xl font-extrabold text-white">$49</span>
                  <span className="text-surface-600 ml-1">/mo</span>
                </div>
                <ul className="mt-7 space-y-3">
                  {["Unlimited projects", "All 5 AI phases", "Multi-user collaboration", "Priority support", "Export all artifacts", "Custom agent configs"].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="w-full mt-8 flex items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-purple-600/10 px-4 py-2.5 text-sm font-semibold text-purple-300 hover:bg-purple-600/20 transition-colors">
                  Upgrade to Team <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </FadeInSection>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative py-28 border-t border-white/[0.06]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-emerald-600/8 blur-[80px] pointer-events-none" />

          <div className="relative mx-auto max-w-3xl px-6 text-center">
            <FadeInSection>
              <motion.div variants={fadeUp}>
                <h2 className="text-4xl font-bold text-white sm:text-6xl leading-tight">
                  Ready to launch your next{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">big idea</span>?
                </h2>
                <p className="mt-6 text-lg text-surface-700">
                  Join developers and startup teams who use LaunchPadAI
                  to go from concept to launch with confidence.
                </p>
                <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/auth/signup" className="btn-primary px-8 py-3.5 text-base">
                    Start Building Free <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            </FadeInSection>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandLogo size="sm" />
            <div className="flex items-center gap-6 text-sm text-surface-600">
              <a href="#phases" className="hover:text-white transition-colors">Phases</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </div>
            <p className="text-xs text-surface-600">
              &copy; {new Date().getFullYear()} LaunchPadAI. Built with AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
