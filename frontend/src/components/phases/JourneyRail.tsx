"use client";

import {
  Check,
  Loader2,
  Lock,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  FileText,
  Code2,
  Rocket,
  Globe,
  Users,
  Compass,
  Pencil,
} from "lucide-react";
import type { Project, Phase } from "@/lib/api";

const PHASE_ORDER = ["discovery", "validation", "landing_page", "prd", "coding_context", "gtm"];

const JOURNEY_STEPS: Record<
  string,
  {
    label: string;
    sublabel: string;
    icon: React.ElementType;
    color: string;
    gradient: string;
    completedSummary: string;
  }
> = {
  discovery: {
    label: "Explore Idea",
    sublabel: "What are we really solving?",
    icon: Compass,
    color: "#06b6d4",
    gradient: "from-cyan-500 to-blue-500",
    completedSummary: "Project Brief ready",
  },
  validation: {
    label: "Validate Idea",
    sublabel: "Is there a market?",
    icon: Lightbulb,
    color: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
    completedSummary: "Market validated",
  },
  landing_page: {
    label: "Landing Page",
    sublabel: "Capture real demand",
    icon: Globe,
    color: "#ec4899",
    gradient: "from-pink-500 to-rose-500",
    completedSummary: "Landing page live",
  },
  prd: {
    label: "Write PRD",
    sublabel: "What are we building?",
    icon: FileText,
    color: "#3b82f6",
    gradient: "from-blue-500 to-indigo-500",
    completedSummary: "Product spec ready",
  },
  coding_context: {
    label: "Build It",
    sublabel: "How do we build it?",
    icon: Code2,
    color: "#22c55e",
    gradient: "from-green-500 to-emerald-500",
    completedSummary: "Coding context exported",
  },
  gtm: {
    label: "Launch",
    sublabel: "How do we get users?",
    icon: Rocket,
    color: "#a855f7",
    gradient: "from-purple-500 to-pink-500",
    completedSummary: "Launch playbook ready",
  },
};

interface JourneyRailProps {
  phases: Phase[];
  activePhase: string;
  onSelectPhase: (phaseType: string) => void;
  project: Project;
}

export default function JourneyRail({
  phases,
  activePhase,
  onSelectPhase,
  project,
}: JourneyRailProps) {
  const completedCount = phases.filter((p) => p.status === "accepted").length;
  const progressPct = Math.round((completedCount / PHASE_ORDER.length) * 100);

  return (
    <div className="w-56 shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
      {/* Project identity */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Your journey
          </p>
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/50" />
        </div>
        <h2 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
          {project.name}
        </h2>
        {(project.domain || project.target_audience) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.domain && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-accent border border-border rounded-full px-2 py-0.5">
                <Globe className="h-2.5 w-2.5" />
                {project.domain}
              </span>
            )}
            {project.target_audience && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-accent border border-border rounded-full px-2 py-0.5">
                <Users className="h-2.5 w-2.5" />
                {project.target_audience}
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              {completedCount} of {PHASE_ORDER.length} done
            </span>
            <span className="text-[10px] font-semibold text-foreground">
              {progressPct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Journey steps */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <div className="relative">
          {/* Gradient connector line */}
          <div className="absolute left-[21px] top-5 bottom-5 w-px bg-gradient-to-b from-cyan-500/20 via-blue-500/15 to-purple-500/20" />

          <div className="space-y-0.5">
            {PHASE_ORDER.map((pt, idx) => {
              const step = JOURNEY_STEPS[pt];
              const statusPriority = (s: string) => {
                if (s === "accepted") return 0;
                if (s === "in_review") return 1;
                if (s === "completed") return 2;
                return 3;
              };
              const phase = phases
                .filter((p) => p.phase_type === pt)
                .sort((a, b) => {
                  const pa = statusPriority(a.status);
                  const pb = statusPriority(b.status);
                  if (pa !== pb) return pa - pb;
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                })[0];
              const Icon = step.icon;

              let status: string = "locked";
              if (phase) {
                status = phase.status;
              } else if (
                idx === 0 ||
                phases.some(
                  (p) =>
                    p.phase_type === PHASE_ORDER[idx - 1] &&
                    p.status === "accepted"
                )
              ) {
                status = "pending";
              }

              const isActive = activePhase === pt;
              const isAccepted = status === "accepted";
              const isCompleted = status === "completed";
              const isInReview = status === "in_review";
              const isDone = isAccepted || isCompleted;
              const isRunning = status === "running" || status === "queued";
              const isLocked = status === "locked";
              const isClickable = !isLocked;

              return (
                <button
                  key={pt}
                  onClick={() => isClickable && onSelectPhase(pt)}
                  disabled={isLocked}
                  className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.08] border border-emerald-500/20"
                      : isClickable
                      ? "hover:bg-accent border border-transparent cursor-pointer"
                      : "cursor-default opacity-40 border border-transparent"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-gradient-to-b ${step.gradient}`}
                    />
                  )}

                  <div
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor:
                        isDone || isInReview || isRunning || isActive
                          ? `${step.color}12`
                          : "hsl(var(--secondary))",
                      color:
                        isDone || isInReview || isRunning || isActive
                          ? step.color
                          : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 text-green-400" strokeWidth={3} />
                    ) : isInReview ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    ) : isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: step.color }} />
                    ) : isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : status === "failed" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[11px] font-semibold leading-tight ${
                        isActive
                          ? "text-foreground"
                          : isDone
                          ? "text-foreground/70"
                          : isLocked
                          ? "text-muted-foreground"
                          : "text-foreground/90"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate">
                      {isDone
                        ? step.completedSummary
                        : isInReview
                        ? "Awaiting your review"
                        : isRunning
                        ? "In progress..."
                        : step.sublabel}
                    </p>
                  </div>

                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  {isRunning && !isActive && (
                    <div className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: step.color }} />
                  )}
                  {isInReview && !isActive && (
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
          Idea
        </p>
        <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-4">
          {project.raw_idea}
        </p>
      </div>
    </div>
  );
}
