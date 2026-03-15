"use client";

import {
  Lightbulb,
  FileText,
  Code2,
  Rocket,
  CheckCircle2,
  Loader2,
  Lock,
  AlertCircle,
  Eye,
} from "lucide-react";

export type PhaseStatus =
  | "locked"
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "in_review"
  | "accepted"
  | "failed";

export interface PhaseInfo {
  type: string;
  label: string;
  status: PhaseStatus;
}

const PHASE_ICON: Record<string, React.ElementType> = {
  validation: Lightbulb,
  prd: FileText,
  coding_context: Code2,
  gtm: Rocket,
};

const PHASE_COLOR: Record<string, string> = {
  validation: "#f59e0b",
  prd: "#3b82f6",
  coding_context: "#22c55e",
  gtm: "#a855f7",
};

interface PhaseJourneyProps {
  phases: PhaseInfo[];
  activePhase: string;
  onSelectPhase: (phaseType: string) => void;
}

function StatusIndicator({ status, color }: { status: PhaseStatus; color: string }) {
  switch (status) {
    case "accepted":
    case "completed":
      return (
        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-green-500 ring-2 ring-background">
          <CheckCircle2 className="h-3 w-3 text-white" />
        </div>
      );
    case "in_review":
      return (
        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-background">
          <Eye className="h-3 w-3 text-white" />
        </div>
      );
    case "running":
    case "queued":
      return (
        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full ring-2 ring-background" style={{ backgroundColor: color }}>
          <Loader2 className="h-3 w-3 text-white animate-spin" />
        </div>
      );
    case "failed":
      return (
        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-background">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      );
    case "locked":
      return (
        <div className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-muted ring-2 ring-background">
          <Lock className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      );
    default:
      return null;
  }
}

export default function PhaseJourney({
  phases,
  activePhase,
  onSelectPhase,
}: PhaseJourneyProps) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3 border-b border-white/[0.06] bg-white/[0.01]">
      {phases.map((phase, idx) => {
        const Icon = PHASE_ICON[phase.type] || Lightbulb;
        const color = PHASE_COLOR[phase.type] || "#6366f1";
        const isActive = activePhase === phase.type;
        const isClickable = phase.status !== "locked";
        const isCompleted = phase.status === "completed" || phase.status === "accepted";
        const isInReview = phase.status === "in_review";
        const isRunning = phase.status === "running" || phase.status === "queued";

        return (
          <div key={phase.type} className="flex items-center">
            {/* Connector line */}
            {idx > 0 && (
              <div className="w-12 sm:w-20 h-px mx-1">
                <div
                  className="h-full transition-colors duration-500"
                  style={{
                    backgroundColor: isCompleted || ["completed", "accepted"].includes(phases[idx - 1]?.status)
                      ? "#22c55e"
                      : "hsl(var(--border))",
                  }}
                />
              </div>
            )}

            {/* Phase node */}
            <button
              onClick={() => isClickable && onSelectPhase(phase.type)}
              disabled={!isClickable}
              className={`group relative flex flex-col items-center gap-1.5 transition-all duration-200 ${
                isClickable ? "cursor-pointer" : "cursor-default opacity-50"
              }`}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${phase.label} — ${phase.status}`}
            >
              {/* Icon circle */}
              <div
                className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${
                  isActive
                    ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                    : ""
                }`}
                style={{
                  backgroundColor: isActive || isCompleted || isInReview || isRunning
                    ? `${color}20`
                    : "hsl(var(--muted))",
                  color: isActive || isCompleted || isInReview || isRunning ? color : "hsl(var(--muted-foreground))",
                  ...(isActive ? { "--tw-ring-color": `${color}60` } as React.CSSProperties : {}),
                }}
              >
                <Icon className="h-5 w-5" />
                <StatusIndicator status={phase.status} color={color} />
              </div>

              {/* Label */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                  style={isActive ? { color } : {}}
                >
                  Phase {idx + 1}
                </span>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? "text-foreground"
                      : isCompleted
                        ? "text-foreground/80"
                        : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
