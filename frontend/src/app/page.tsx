"use client";

import Link from "next/link";
import {
  Lightbulb,
  FileText,
  Code2,
  Rocket,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Users,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  Bot,
  Layers,
  Cpu,
} from "lucide-react";

function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10" : size === "md" ? "h-8 w-8" : "h-7 w-7";
  const icon = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const text = size === "lg" ? "text-xl" : size === "md" ? "text-lg" : "text-sm";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${dim} items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600 shadow-lg shadow-brand-600/20`}>
        <Rocket className={`${icon} text-white -rotate-45`} />
      </div>
      <span className={`${text} font-bold text-white`}>
        LaunchPad<span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">AI</span>
      </span>
    </div>
  );
}

const phases = [
  {
    icon: Lightbulb,
    title: "Idea Validation",
    agents: ["Market Research Analyst", "Feasibility Analyst", "Persona Researcher", "Synthesizer"],
    description: "AI agents analyze market size, competitive landscape, technical feasibility, and build user personas — then synthesize a go/no-go scorecard.",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: FileText,
    title: "PRD Generation",
    agents: ["Requirements Analyst", "Feature Prioritizer", "UX Flow Designer", "PRD Writer"],
    description: "Auto-generate a complete Product Requirements Document with MoSCoW-prioritized features, user flows, and acceptance criteria.",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Code2,
    title: "Coding Context",
    agents: ["System Architect", "Schema Designer", "Task Decomposer", "Context Packager"],
    description: "Export system architecture, database schemas, developer tasks, and AI-coding-assistant context files (.cursorrules, CODING_CONTEXT.md).",
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: Rocket,
    title: "Go-to-Market",
    agents: ["Positioning Strategist", "Channel Strategist", "Content Creator", "Launch Planner"],
    description: "Get positioning, channel strategy, landing page copy, social posts, email sequences, and a week-by-week launch playbook.",
    color: "from-purple-500 to-pink-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
];

const features = [
  { icon: Cpu, title: "16 Specialized AI Agents", description: "Four crews of expert agents, each with deep domain knowledge in their area." },
  { icon: MessageSquare, title: "Chat-Based Interaction", description: "Talk to your AI co-founder naturally. No forms — just a conversation." },
  { icon: Zap, title: "Cross-Phase Context", description: "pgvector RAG ensures every phase builds on insights from previous ones." },
  { icon: Shield, title: "Production-Ready Output", description: "Get deployable artifacts: PRDs, architecture docs, task lists, launch plans." },
  { icon: BarChart3, title: "Validation Scorecards", description: "Data-driven go/no-go decisions with market, feasibility, and user-need scores." },
  { icon: Layers, title: "Interactive Canvas", description: "Visual workflow with draggable nodes. Expand, edit, and download artifacts inline." },
];

const stats = [
  { value: "16", label: "AI Agents" },
  { value: "4", label: "Phases" },
  { value: "~2 min", label: "Per Phase" },
  { value: "20+", label: "Artifacts Generated" },
];

export default function LandingPage() {
  return (
    <div className="dark min-h-screen bg-surface-0">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-surface-300/50 bg-surface-0/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/">
            <BrandLogo />
          </Link>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#phases" className="text-sm text-surface-700 hover:text-white transition-colors">Phases</a>
            <a href="#features" className="text-sm text-surface-700 hover:text-white transition-colors">Features</a>
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
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-950/50 via-surface-0 to-surface-0" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-brand-600/10 blur-[120px]" />
          <div className="absolute top-40 left-1/4 h-[300px] w-[300px] rounded-full bg-orange-500/5 blur-[100px]" />

          <div className="relative mx-auto max-w-4xl px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-surface-400 bg-surface-200 px-4 py-1.5 text-xs font-medium text-surface-800 mb-8 animate-fade-in">
              <Rocket className="h-3.5 w-3.5 text-orange-400 -rotate-45" />
              Your AI co-founder for idea to launch
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl animate-fade-in">
              Launch your next{" "}
              <span className="bg-gradient-to-r from-orange-400 via-brand-400 to-purple-400 bg-clip-text text-transparent">big idea</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-surface-700 leading-relaxed animate-slide-up">
              LaunchPadAI guides you from raw idea to go-to-market with 16 specialized
              AI agents. Validate, plan, architect, and launch — all through a natural
              conversation with your AI co-founder.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4 animate-slide-up">
              <Link href="/auth/signup" className="btn-primary px-8 py-3 text-base">
                Start Building Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#phases" className="btn-secondary px-8 py-3 text-base">
                See How It Works
              </a>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 animate-slide-up">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-surface-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Phases */}
        <section id="phases" className="relative py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-400">The Pipeline</span>
              <h2 className="mt-3 text-4xl font-bold text-white">Four AI-powered phases</h2>
              <p className="mx-auto mt-4 max-w-2xl text-surface-700">
                Each phase runs a crew of specialized agents. Context flows between phases
                via semantic vector search, so every step builds on the last.
              </p>
            </div>

            <div className="mt-16 space-y-6">
              {phases.map((phase, i) => (
                <div key={phase.title} className={`rounded-2xl border ${phase.border} ${phase.bg} p-6 sm:p-8 transition-all hover:scale-[1.01]`}>
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-4 sm:w-72 shrink-0">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${phase.color}`}>
                        <phase.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-surface-600 uppercase tracking-wider">Phase {i + 1}</div>
                        <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-surface-800 leading-relaxed">{phase.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {phase.agents.map((agent) => (
                          <span key={agent} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400 bg-surface-200 px-2.5 py-1 text-xs text-surface-800">
                            <Bot className="h-3 w-3 text-surface-600" />
                            {agent}
                          </span>
                        ))}
                      </div>
                    </div>
                    {i < phases.length - 1 && (
                      <div className="hidden sm:flex items-center text-surface-500">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 border-t border-surface-300">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-400">Why LaunchPadAI</span>
              <h2 className="mt-3 text-4xl font-bold text-white">Everything you need to ship</h2>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="card-hover group">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/10 text-brand-400 transition-colors group-hover:bg-brand-600/20">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm text-surface-700 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 border-t border-surface-300">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-400">How It Works</span>
              <h2 className="mt-3 text-4xl font-bold text-white">Three steps to launch</h2>
            </div>
            <div className="mt-16 space-y-12">
              {[
                { step: "01", title: "Describe your idea", desc: "Create a project and tell your AI co-founder about your idea in plain language. No templates, no forms — just talk." },
                { step: "02", title: "Let agents work", desc: "16 specialized AI agents analyze, research, plan, and create production-ready artifacts across all 4 phases." },
                { step: "03", title: "Ship it", desc: "Export your PRD, architecture docs, task lists, and launch plan. Start coding with full context from day one." },
              ].map((item) => (
                <div key={item.step} className="flex gap-6 items-start">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-400 font-bold text-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{item.title}</h3>
                    <p className="mt-2 text-surface-700 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 border-t border-surface-300">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <span className="text-sm font-semibold uppercase tracking-wider text-brand-400">Pricing</span>
              <h2 className="mt-3 text-4xl font-bold text-white">Simple pricing for builders</h2>
              <p className="mt-4 text-surface-700">Start free. Scale when you&apos;re ready.</p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              {/* Free */}
              <div className="card">
                <h3 className="text-lg font-bold text-white">Free</h3>
                <p className="mt-1 text-xs text-surface-600">For trying out LaunchPadAI</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-surface-600 ml-1">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {["1 project", "All 4 AI phases", "Chat with AI co-founder", "Community support"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="btn-secondary w-full mt-8">Get Started Free</Link>
              </div>

              {/* Pro */}
              <div className="card relative border-brand-600/50 bg-brand-950/20">
                <div className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Popular</div>
                <h3 className="text-lg font-bold text-white">Pro</h3>
                <p className="mt-1 text-xs text-surface-600">For serious builders</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-white">$19</span>
                  <span className="text-surface-600 ml-1">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {["Up to 5 projects", "All 4 AI phases", "Export artifacts", "Email support"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-brand-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="btn-primary w-full mt-8">
                  Upgrade to Pro <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Team */}
              <div className="card border-purple-500/30">
                <h3 className="text-lg font-bold text-white">Team</h3>
                <p className="mt-1 text-xs text-surface-600">For startups & teams</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-white">$49</span>
                  <span className="text-surface-600 ml-1">/month</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {["Unlimited projects", "All 4 AI phases", "Multi-user collaboration", "Priority support", "Export artifacts"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-surface-800">
                      <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="w-full mt-8 flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-600/10 px-4 py-2.5 text-sm font-semibold text-purple-300 hover:bg-purple-600/20 transition-colors">
                  Upgrade to Team <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 border-t border-surface-300">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-4xl font-bold text-white sm:text-5xl">
              Ready to launch your next{" "}
              <span className="bg-gradient-to-r from-orange-400 via-brand-400 to-purple-400 bg-clip-text text-transparent">big idea</span>?
            </h2>
            <p className="mt-6 text-lg text-surface-700">
              Join hundreds of indie developers and startup teams who use LaunchPadAI
              to go from concept to launch faster than ever.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/auth/signup" className="btn-primary px-8 py-3 text-base">
                Start Building Free <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-300 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandLogo size="sm" />
            <div className="flex items-center gap-6 text-sm text-surface-600">
              <a href="#phases" className="hover:text-white transition-colors">Phases</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
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
