"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  Zap,
  AlertCircle,
  Cpu,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AgentProgress } from "@/lib/useAgentProgress";

const PHASE_LABELS: Record<string, string> = {
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

interface AgentActivityFeedProps {
  progress: AgentProgress;
}

export default function AgentActivityFeed({ progress }: AgentActivityFeedProps) {
  const [expanded, setExpanded] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current && expanded) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [progress.events, expanded]);

  if (!progress.isRunning && progress.events.length === 0 && !progress.error) {
    return null;
  }

  const phaseLabel = progress.phaseType
    ? PHASE_LABELS[progress.phaseType] || progress.phaseType
    : "AI Agents";

  const totalAgents = progress.agents.length;
  const completedCount = progress.completedAgents.length;
  const progressPct = totalAgents > 0 ? Math.round((completedCount / totalAgents) * 100) : 0;

  return (
    <div className="absolute top-3 right-3 z-30 w-80 rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-slide-in-right">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {progress.isRunning ? (
            <div className="relative flex h-7 w-7 items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-brand-500/20 animate-pulse" />
              <Cpu className="h-4 w-4 text-brand-400 relative z-10" />
            </div>
          ) : progress.error ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/15">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
          )}
          <div className="text-left">
            <h3 className="text-xs font-semibold text-foreground">{phaseLabel}</h3>
            <p className="text-[10px] text-muted-foreground">
              {progress.isRunning
                ? `${completedCount}/${totalAgents} agents complete`
                : progress.error
                  ? "Failed"
                  : "Complete"}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Progress bar */}
      {progress.isRunning && totalAgents > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progressPct, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Feed */}
      {expanded && (
        <div
          ref={feedRef}
          className="max-h-64 overflow-y-auto px-4 pb-3 space-y-1.5"
        >
          {progress.agents.map((agentName) => {
            const isCompleted = progress.completedAgents.includes(agentName);
            const isActive = progress.activeAgent === agentName;
            const agentEvents = progress.events.filter(
              (e) => e.agent === agentName
            );
            const lastEvent = agentEvents[agentEvents.length - 1];

            return (
              <div
                key={agentName}
                className={`rounded-xl px-3 py-2 transition-all duration-300 ${
                  isActive
                    ? "bg-brand-500/10 border border-brand-500/30"
                    : isCompleted
                      ? "bg-green-500/5 border border-border/40"
                      : "bg-muted/50 border border-border/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 text-brand-400 animate-spin shrink-0" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`text-xs font-medium truncate ${
                      isActive
                        ? "text-brand-300"
                        : isCompleted
                          ? "text-green-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    {agentName}
                  </span>
                </div>

                {isActive && progress.activeTask && (
                  <p className="mt-1 ml-6 text-[10px] text-muted-foreground leading-snug">
                    {progress.activeTask}
                  </p>
                )}

                {isCompleted && lastEvent?.type === "agent_complete" && lastEvent.summary && (
                  <p className="mt-1 ml-6 text-[10px] text-muted-foreground leading-snug line-clamp-2">
                    {lastEvent.summary.slice(0, 120)}
                    {lastEvent.summary.length > 120 ? "..." : ""}
                  </p>
                )}
              </div>
            );
          })}

          {progress.error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 mt-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-300 font-medium">Error</span>
              </div>
              <p className="mt-1 ml-6 text-[10px] text-red-400/80 leading-snug">
                {progress.error}
              </p>
            </div>
          )}

          {!progress.isRunning && !progress.error && completedCount > 0 && (
            <div className="flex items-center gap-2 pt-1 text-[10px] text-green-400/70">
              <Zap className="h-3 w-3" />
              All agents finished — results on the canvas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
