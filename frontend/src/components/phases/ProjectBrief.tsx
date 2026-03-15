"use client";

import {
  Lightbulb,
  Target,
  Users,
  Globe,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  AlertCircle,
  Eye,
} from "lucide-react";
import type { Project, Phase } from "@/lib/api";

const PHASE_ORDER = ["validation", "prd", "coding_context", "gtm"];

const PHASE_LABELS: Record<string, string> = {
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

interface ProjectBriefProps {
  project: Project;
  phases: Phase[];
}

export default function ProjectBrief({ project, phases }: ProjectBriefProps) {
  const completedCount = phases.filter((p) => p.status === "accepted").length;
  const progressPct = Math.round((completedCount / PHASE_ORDER.length) * 100);

  return (
    <div className="w-64 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Project info */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Project Brief
          </h3>
          <h2 className="mt-2 text-sm font-bold text-foreground leading-snug">
            {project.name}
          </h2>
        </div>

        {/* Idea */}
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <Lightbulb className="h-3 w-3" />
            Idea
          </div>
          <p className="mt-1 text-xs text-foreground/80 leading-relaxed line-clamp-6">
            {project.raw_idea}
          </p>
        </div>

        {/* Domain & Audience */}
        {(project.domain || project.target_audience) && (
          <div className="space-y-2">
            {project.domain && (
              <div className="flex items-start gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Domain</p>
                  <p className="text-xs text-foreground/80">{project.domain}</p>
                </div>
              </div>
            )}
            {project.target_audience && (
              <div className="flex items-start gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Audience</p>
                  <p className="text-xs text-foreground/80">{project.target_audience}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-secondary" />

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Progress
            </h3>
            <span className="text-xs font-semibold text-foreground">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-purple-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {completedCount}/{PHASE_ORDER.length} phases complete
          </p>
        </div>

        {/* Phase checklist */}
        <div className="space-y-1.5">
          {PHASE_ORDER.map((pt) => {
            const phase = phases.find((p) => p.phase_type === pt);
            const status = phase?.status || "locked";

            return (
              <div
                key={pt}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                  status === "accepted" || status === "completed"
                    ? "bg-green-500/5"
                    : status === "in_review"
                      ? "bg-blue-500/5"
                      : status === "running" || status === "queued"
                        ? "bg-emerald-500/5"
                        : ""
                }`}
              >
                <PhaseStatusIcon status={status} />
                <span
                  className={`text-xs ${
                    status === "accepted" || status === "completed"
                      ? "text-foreground/80 line-through"
                      : status === "in_review"
                        ? "text-foreground font-medium"
                        : status === "running" || status === "queued"
                          ? "text-foreground font-medium"
                          : status === "locked"
                            ? "text-muted-foreground"
                            : "text-foreground"
                  }`}
                >
                  {PHASE_LABELS[pt]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "accepted":
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />;
    case "in_review":
      return <Eye className="h-4 w-4 text-blue-400 shrink-0" />;
    case "running":
    case "queued":
      return <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case "pending":
      return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
    default:
      return <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}
