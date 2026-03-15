"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  RefreshCw,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Circle,
  FileText,
  Pencil,
  Save,
  RotateCcw,
  X,
  Copy,
  Check,
  Lightbulb,
  Code2,
  Rocket,
  Bot,
  Clock,
  ChevronDown,
  ChevronUp,
  Ban,
  Compass,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Eye,
  SendHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, ApiError, Artifact, Phase, PhaseFeedback, FeedbackType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { AgentProgress } from "@/lib/useAgentProgress";

export type PhaseStatus =
  | "locked"
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "in_review"
  | "accepted"
  | "failed";

interface PhasePageProps {
  projectId: string;
  phaseType: string;
  phases: Phase[];
  agentProgress: AgentProgress;
  onPhaseStarted: () => void;
  onNavigateToPhase?: (phaseType: string) => void;
}

const PHASE_META: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.ElementType;
    description: string;
    agents: { name: string; task: string }[];
    estimatedTime: string;
  }
> = {
  discovery: {
    label: "Discovery Session",
    color: "#06b6d4",
    icon: Compass,
    description:
      "A structured pre-phase where AI agents explore your problem space, challenge assumptions, map competitors, and produce a Project Brief.",
    agents: [
      { name: "Problem Explorer", task: "Problem statement, depth analysis, and evidence" },
      { name: "Assumption Challenger", task: "Assumptions inventory and risk tiering" },
      { name: "Opportunity Mapper", task: "Competitive landscape and whitespace analysis" },
      { name: "Brief Builder", task: "Synthesising all findings into the Project Brief" },
    ],
    estimatedTime: "~2 min",
  },
  validation: {
    label: "Idea Validation",
    color: "#f59e0b",
    icon: Lightbulb,
    description:
      "AI agents analyze market size, competitive landscape, technical feasibility, and build user personas to produce a go/no-go scorecard.",
    agents: [
      { name: "Market Size Research", task: "TAM/SAM/SOM analysis and market opportunity" },
      { name: "Competitor Analysis", task: "Competitive landscape and differentiation" },
      { name: "Technical Feasibility", task: "Technical viability and stack requirements" },
      { name: "Persona Research", task: "User personas, pain points, and needs" },
      { name: "Validation Synthesis", task: "Go/no-go scorecard with recommendations" },
    ],
    estimatedTime: "~2 min",
  },
  prd: {
    label: "PRD Generation",
    color: "#3b82f6",
    icon: FileText,
    description:
      "Auto-generate a complete Product Requirements Document with MoSCoW-prioritized features, user flows, and acceptance criteria.",
    agents: [
      { name: "Requirements Analyst", task: "Gathering and structuring requirements" },
      { name: "User Story Mapper", task: "User stories and acceptance criteria" },
      { name: "Feature Prioritizer", task: "MoSCoW-based feature prioritization" },
      { name: "UX Flow Designer", task: "User experience flows and interactions" },
      { name: "PRD Writer", task: "Comprehensive product requirements document" },
    ],
    estimatedTime: "~2 min",
  },
  coding_context: {
    label: "Coding Context",
    color: "#22c55e",
    icon: Code2,
    description:
      "Export system architecture, database schemas, developer tasks, and AI-coding-assistant context files.",
    agents: [
      { name: "System Architect", task: "System architecture and component diagram" },
      { name: "Schema Designer", task: "Database schema and API contracts" },
      { name: "Task Decomposer", task: "Actionable development task breakdown" },
      { name: ".cursorrules Generator", task: "AI coding assistant configuration" },
      { name: "Context Packager", task: "IDE integration files and CODING_CONTEXT.md" },
    ],
    estimatedTime: "~2 min",
  },
  gtm: {
    label: "Go-to-Market",
    color: "#a855f7",
    icon: Rocket,
    description:
      "Get positioning, channel strategy, landing page copy, social posts, email sequences, and a launch playbook.",
    agents: [
      { name: "Positioning Strategist", task: "Positioning strategy and value props" },
      { name: "Channel Strategist", task: "Marketing and distribution channels" },
      { name: "Content Strategist", task: "Marketing content and messaging" },
      { name: "Launch Planner", task: "Launch timeline and action plan" },
      { name: "GTM Playbook Assembler", task: "Complete go-to-market playbook" },
    ],
    estimatedTime: "~2 min",
  },
};

const PHASE_ORDER = ["discovery", "validation", "prd", "coding_context", "gtm"];

function stripCodeFences(raw: string): string {
  let s = raw.trim();
  const fencePattern = /^```(?:markdown|md|text)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = s.match(fencePattern);
  if (match) return match[1].trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-z]*\s*\n?/, "");
    s = s.replace(/\n?\s*```$/, "");
  }
  return s.trim();
}

export default function PhasePage({
  projectId,
  phaseType,
  phases,
  agentProgress,
  onPhaseStarted,
}: PhasePageProps) {
  const { getToken } = useAuth();
  const toast = useToast();
  const meta = PHASE_META[phaseType];
  const Icon = meta?.icon || Lightbulb;

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, PhaseFeedback[]>>({});

  const statusPriority = (s: string) => {
    if (s === "accepted") return 0;
    if (s === "in_review") return 1;
    if (s === "completed") return 2;
    return 3;
  };

  const phase = phases
    .filter((p) => p.phase_type === phaseType)
    .sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];
  const phaseIdx = PHASE_ORDER.indexOf(phaseType);
  const prevPhase = phaseIdx > 0 ? PHASE_ORDER[phaseIdx - 1] : null;
  const prevAccepted = prevPhase
    ? phases.some((p) => p.phase_type === prevPhase && p.status === "accepted")
    : true;

  let status: PhaseStatus = "locked";
  if (phase) {
    status = phase.status as PhaseStatus;
  } else if (phaseIdx === 0 || prevAccepted) {
    status = "pending";
  }

  const isRunning = status === "running" || status === "queued";
  const isInReview = status === "in_review";
  const isAccepted = status === "accepted";
  const isCompleted = status === "completed";
  const showArtifacts = isInReview || isAccepted || isCompleted;
  const canStart = status === "pending" && prevAccepted;
  const canRerun = isAccepted || isCompleted || status === "failed";

  const allFeedback = Object.values(feedbackMap).flat();
  const hasNegativeFeedback = allFeedback.some(
    (f) => f.feedback_type === "thumbs_down" || f.feedback_type === "comment"
  );
  const negativeArtifactAgents = new Set(
    allFeedback
      .filter((f) => f.feedback_type === "thumbs_down")
      .map((f) => {
        const art = artifacts.find((a) => a.id === f.artifact_id);
        return art?.agent_name;
      })
      .filter(Boolean) as string[]
  );

  const stuckThresholdMs = 5 * 60 * 1000;
  const isStuck =
    isRunning &&
    phase?.started_at &&
    Date.now() - new Date(phase.started_at).getTime() > stuckThresholdMs;

  const fetchArtifacts = useCallback(async () => {
    if (!showArtifacts) return;
    const token = getToken();
    if (!token) return;
    setLoadingArtifacts(true);
    try {
      const detail = await api.phases.detail(token, projectId, phaseType);
      setArtifacts(detail.artifacts);
    } catch {
      // non-critical
    } finally {
      setLoadingArtifacts(false);
    }
  }, [projectId, phaseType, showArtifacts, getToken]);

  const fetchFeedback = useCallback(async () => {
    if (!isInReview && !isAccepted) return;
    const token = getToken();
    if (!token) return;
    try {
      const items = await api.phases.listFeedback(token, projectId, phaseType);
      const grouped: Record<string, PhaseFeedback[]> = {};
      for (const fb of items) {
        const key = fb.artifact_id || "__phase__";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(fb);
      }
      setFeedbackMap(grouped);
    } catch {
      // non-critical
    }
  }, [projectId, phaseType, isInReview, isAccepted, getToken]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  useEffect(() => {
    if (!agentProgress.isRunning && agentProgress.completedAgents.length > 0 && agentProgress.phaseType === phaseType) {
      setTimeout(() => {
        fetchArtifacts();
        fetchFeedback();
      }, 1500);
    }
  }, [agentProgress.isRunning, agentProgress.completedAgents.length, agentProgress.phaseType, phaseType, fetchArtifacts, fetchFeedback]);

  async function handleStart() {
    const token = getToken();
    if (!token) return;
    setStarting(true);
    try {
      await api.phases.run(token, projectId, phaseType);
      onPhaseStarted();
      toast.add("success", `${meta?.label || phaseType} phase started!`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.add("error", "Phase is already running. Cancel it first if it appears stuck.");
      } else if (err instanceof ApiError && err.status === 400) {
        toast.add("error", "Accept the previous phase first.");
      } else {
        toast.add("error", "Failed to start phase. Check that the backend is running.");
      }
    } finally {
      setStarting(false);
    }
  }

  async function handleRerun() {
    const token = getToken();
    if (!token) return;
    setRerunning(true);
    try {
      await api.phases.run(token, projectId, phaseType);
      setArtifacts([]);
      onPhaseStarted();
      toast.add("success", `Re-running ${meta?.label || phaseType}...`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.add("error", "Phase is already running. Cancel it first if it appears stuck.");
      } else {
        toast.add("error", "Failed to re-run phase.");
      }
    } finally {
      setRerunning(false);
    }
  }

  async function handleCancel() {
    const token = getToken();
    if (!token) return;
    setCancelling(true);
    try {
      await api.phases.cancel(token, projectId, phaseType);
      onPhaseStarted();
      toast.add("success", "Phase cancelled. You can start it again.");
    } catch {
      toast.add("error", "Failed to cancel phase.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleDownload() {
    const token = getToken();
    if (!token) return;
    try {
      await api.phases.exportZip(token, projectId, phaseType);
    } catch {
      toast.add("error", "Download failed.");
    }
  }

  async function handleAccept() {
    const token = getToken();
    if (!token) return;
    setAccepting(true);
    try {
      await api.phases.acceptPhase(token, projectId, phaseType);
      onPhaseStarted();
      toast.add("success", `${meta?.label || phaseType} accepted!`);
    } catch {
      toast.add("error", "Failed to accept phase.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleRefine() {
    const token = getToken();
    if (!token) return;
    const agents = negativeArtifactAgents.size > 0
      ? Array.from(negativeArtifactAgents)
      : (meta?.agents.map((a) => a.name) || []);
    if (agents.length === 0) return;

    setRefining(true);
    try {
      await api.phases.refine(token, projectId, phaseType, agents);
      setArtifacts([]);
      onPhaseStarted();
      toast.add("success", `Refining ${meta?.label || phaseType} with your feedback...`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.add("error", "Phase is already running.");
      } else {
        toast.add("error", "Failed to start refinement.");
      }
    } finally {
      setRefining(false);
    }
  }

  async function handleSubmitFeedback(
    artifactId: string,
    section: string,
    feedbackType: FeedbackType,
    comment?: string
  ) {
    const token = getToken();
    if (!token) return;
    try {
      await api.phases.submitFeedback(token, projectId, phaseType, {
        artifact_id: artifactId,
        section,
        feedback_type: feedbackType,
        comment: comment || null,
      });
      await fetchFeedback();
    } catch {
      toast.add("error", "Failed to submit feedback.");
    }
  }

  if (!meta) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-8 space-y-6">
        {/* Phase Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-foreground">{meta.label}</h1>
                <StatusBadge status={status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground max-w-lg leading-relaxed">
                {meta.description}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {meta.estimatedTime}
              </div>
            </div>
          </div>

          {/* Compact actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canStart && (
              <button onClick={handleStart} disabled={starting} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50">
                {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Start
              </button>
            )}
            {isInReview && (
              <>
                <button
                  onClick={handleRefine}
                  disabled={refining || !hasNegativeFeedback}
                  title={!hasNegativeFeedback ? "Add feedback first" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                >
                  {refining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3 w-3" />}
                  Refine
                </button>
                <button onClick={handleAccept} disabled={accepting} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50">
                  {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Accept
                </button>
              </>
            )}
            {canRerun && (
              <button onClick={handleRerun} disabled={rerunning} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                {rerunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Re-run
              </button>
            )}
            {isRunning && isStuck && (
              <button onClick={handleCancel} disabled={cancelling} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                Cancel
              </button>
            )}
            {(isAccepted || isCompleted) && phaseType !== "validation" && (
              <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            )}
          </div>
        </div>

        {/* Stuck warning */}
        {isRunning && isStuck && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">Phase appears stuck</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Over 5 minutes without progress. Click &ldquo;Cancel&rdquo; above to reset, then start again.
              </p>
            </div>
          </div>
        )}

        {/* Agent Progress */}
        {isRunning && agentProgress.phaseType === phaseType && (
          <AgentProgressPanel agents={meta.agents} progress={agentProgress} color={meta.color} />
        )}

        {/* Locked */}
        {status === "locked" && (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent border border-border">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">Phase Locked</h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
              Accept <strong>{PHASE_META[prevPhase || ""]?.label || "the previous phase"}</strong> first to unlock.
            </p>
          </div>
        )}

        {/* Pending */}
        {canStart && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center transition-colors hover:border-accent hover:bg-accent">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${meta.color}10`, color: meta.color }}
            >
              <Icon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">Ready to Start</h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-lg mx-auto">
              {meta.agents.length} AI agents will work on this phase.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 max-w-md mx-auto">
              {meta.agents.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-2 rounded-lg bg-card border border-border px-2.5 py-2 text-left transition-all duration-200 hover:bg-accent hover:border-accent"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${meta.color}12`, color: meta.color }}>
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{agent.task}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed */}
        {status === "failed" && artifacts.length === 0 && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">Phase Failed</h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto">
              Something went wrong. You can re-run the phase.
            </p>
          </div>
        )}

        {/* Review Banner */}
        {isInReview && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] px-4 py-3 flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/15">
              <div className="h-2 w-2 rounded-full bg-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Review Draft Results</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Use <ThumbsUp className="inline h-3 w-3 text-green-400" />/<ThumbsDown className="inline h-3 w-3 text-red-400" /> on sections,
                add comments with <MessageSquare className="inline h-3 w-3 text-blue-400" />.
                Then &ldquo;Accept&rdquo; or &ldquo;Refine&rdquo;.
              </p>
              {allFeedback.length > 0 && (
                <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                  {allFeedback.filter((f) => f.feedback_type === "thumbs_up").length > 0 && (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <ThumbsUp className="h-3 w-3" />
                      {allFeedback.filter((f) => f.feedback_type === "thumbs_up").length}
                    </span>
                  )}
                  {allFeedback.filter((f) => f.feedback_type === "thumbs_down").length > 0 && (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <ThumbsDown className="h-3 w-3" />
                      {allFeedback.filter((f) => f.feedback_type === "thumbs_down").length}
                    </span>
                  )}
                  {allFeedback.filter((f) => f.feedback_type === "comment").length > 0 && (
                    <span className="inline-flex items-center gap-1 text-blue-400">
                      <MessageSquare className="h-3 w-3" />
                      {allFeedback.filter((f) => f.feedback_type === "comment").length}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{meta.estimatedTime}</span>
          </div>
        )}

        {/* Accepted Banner */}
        {isAccepted && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">Phase Accepted</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Results accepted. The next phase is unlocked.
              </p>
            </div>
          </div>
        )}

        {/* Artifacts */}
        {showArtifacts && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Artifacts ({artifacts.length})
              </h2>
            </div>
            {loadingArtifacts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : artifacts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading artifacts...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {artifacts.map((artifact) => (
                  <ArtifactCard
                    key={artifact.id}
                    artifact={artifact}
                    projectId={projectId}
                    color={meta.color}
                    isReviewMode={isInReview || (isAccepted && (feedbackMap[artifact.id] || []).length > 0)}
                    feedback={feedbackMap[artifact.id] || []}
                    onSubmitFeedback={isInReview ? handleSubmitFeedback : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  const config: Record<PhaseStatus, { label: string; cls: string; icon: React.ElementType }> = {
    accepted: { label: "Accepted", cls: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
    completed: { label: "Complete", cls: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
    in_review: { label: "In Review", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Eye },
    running: { label: "Running", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Loader2 },
    queued: { label: "Queued", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Loader2 },
    failed: { label: "Failed", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertCircle },
    pending: { label: "Ready", cls: "bg-accent text-muted-foreground border-border", icon: Circle },
    locked: { label: "Locked", cls: "bg-accent text-muted-foreground border-border", icon: Lock },
  };
  const c = config[status];
  const StatusIcon = c.icon;
  const isSpinning = status === "running" || status === "queued";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>
      <StatusIcon className={`h-2.5 w-2.5 ${isSpinning ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

function AgentProgressPanel({
  agents,
  progress,
  color,
}: {
  agents: { name: string; task: string }[];
  progress: AgentProgress;
  color: string;
}) {
  const completedCount = progress.completedAgents.length;
  const totalAgents = agents.length;
  const progressPct = totalAgents > 0 ? Math.round((completedCount / totalAgents) * 100) : 0;

  const estimatedRemaining = Math.max(0, (totalAgents - completedCount) * 30);
  const remainingLabel =
    estimatedRemaining > 60
      ? `~${Math.ceil(estimatedRemaining / 60)} min`
      : `~${estimatedRemaining}s`;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center">
            <div className="absolute inset-0 rounded-lg animate-pulse" style={{ backgroundColor: `${color}15` }} />
            <Loader2 className="h-3.5 w-3.5 animate-spin relative z-10" style={{ color }} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Agents Working</h3>
            <p className="text-[10px] text-muted-foreground">
              {completedCount}/{totalAgents} &middot; {remainingLabel} left
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{progressPct}%</span>
      </div>

      <div className="h-0.5 w-full bg-accent">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(progressPct, 3)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        />
      </div>

      <div className="px-5 py-3 space-y-2">
        {agents.map((agent, idx) => {
          const isCompleted = progress.completedAgents.includes(agent.name);
          const isActive = progress.activeAgent === agent.name;
          const agentEvents = progress.events.filter((e) => e.agent === agent.name);
          const lastEvent = agentEvents[agentEvents.length - 1];
          const snippet =
            isCompleted && lastEvent?.type === "agent_complete" && lastEvent.summary
              ? lastEvent.summary.slice(0, 150)
              : null;
          const streamText = progress.thinkingStreams[agent.name] || "";

          return (
            <div
              key={agent.name}
              className={`rounded-lg px-3 py-2.5 transition-all duration-200 ${
                isActive
                  ? "bg-card border border-border"
                  : isCompleted
                    ? "bg-green-500/[0.03] border border-green-500/10"
                    : "border border-transparent"
              }`}
            
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                    isCompleted
                      ? "bg-green-500/15 text-green-400"
                      : isActive
                        ? "text-white"
                        : "bg-accent text-muted-foreground"
                  }`}
                  style={isActive ? { backgroundColor: `${color}20`, color } : {}}
                >
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isActive ? "text-foreground" : isCompleted ? "text-foreground/80" : "text-muted-foreground"}`}>
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {isActive ? progress.activeTask || agent.task : agent.task}
                  </p>
                </div>
                {isActive && (
                  <div className="flex gap-0.5 shrink-0">
                    {[0, 150, 300].map((d) => (
                      <div key={d} className="h-1 w-1 rounded-full animate-bounce" style={{ backgroundColor: color, animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                )}
              </div>

              {streamText && (
                <div className="mt-1.5 ml-8 border-l-2 pl-2.5" style={{ borderColor: isActive ? `${color}30` : "rgb(34 197 94 / 0.15)" }}>
                  <p className={`text-[10px] leading-relaxed font-mono break-words ${isActive ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                    {streamText.slice(-300)}
                    {isActive && <span className="inline-block w-1 h-2.5 ml-0.5 bg-current align-middle animate-pulse opacity-70" />}
                  </p>
                </div>
              )}

              {!streamText && snippet && (
                <p className="mt-1.5 ml-8 text-[10px] text-muted-foreground leading-relaxed border-l-2 border-green-500/20 pl-2.5">
                  {snippet}{snippet.length >= 150 ? "..." : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function extractSections(markdown: string): { heading: string; content: string }[] {
  const lines = markdown.split("\n");
  const sections: { heading: string; content: string }[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentHeading || currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines.join("\n") });
      }
      currentHeading = headingMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentHeading || currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines.join("\n") });
  }
  return sections;
}

function SectionFeedbackControls({
  section,
  artifactId,
  feedback,
  onSubmit,
}: {
  section: string;
  artifactId: string;
  feedback: PhaseFeedback[];
  onSubmit: (artifactId: string, section: string, type: FeedbackType, comment?: string) => void;
}) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sectionFeedback = feedback.filter((f) => f.section === section);
  const hasThumbsUp = sectionFeedback.some((f) => f.feedback_type === "thumbs_up");
  const hasThumbsDown = sectionFeedback.some((f) => f.feedback_type === "thumbs_down");
  const comments = sectionFeedback.filter((f) => f.feedback_type === "comment");

  useEffect(() => {
    if (showComment && inputRef.current) inputRef.current.focus();
  }, [showComment]);

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-0.5">
        <button onClick={() => onSubmit(artifactId, section, "thumbs_up")} className={`rounded p-1.5 transition-colors ${hasThumbsUp ? "bg-green-500/20 text-green-400" : "text-muted-foreground/30 hover:text-green-400 hover:bg-green-500/10"}`} title="Looks good">
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onSubmit(artifactId, section, "thumbs_down")} className={`rounded p-1.5 transition-colors ${hasThumbsDown ? "bg-red-500/20 text-red-400" : "text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10"}`} title="Needs improvement">
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(section); }} className="rounded p-1.5 text-muted-foreground/30 hover:text-foreground hover:bg-accent transition-colors" title="Copy section">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setShowComment(!showComment)} className={`rounded p-1.5 transition-colors ${comments.length > 0 ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground/30 hover:text-blue-400 hover:bg-blue-500/10"}`} title="Add comment">
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </div>

      {comments.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {comments.map((c) => (
            <div key={c.id} className="text-[10px] text-muted-foreground bg-card rounded px-2 py-1 border-l-2 border-blue-500/20">
              {c.comment}
            </div>
          ))}
        </div>
      )}

      {showComment && (
        <div className="flex items-center gap-1 mt-1.5">
          <input
            ref={inputRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                onSubmit(artifactId, section, "comment", comment.trim());
                setComment("");
                setShowComment(false);
              }
            }}
            placeholder="Add feedback..."
            className="flex-1 text-[11px] bg-card border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-blue-500/30"
          />
          <button onClick={() => { if (comment.trim()) { onSubmit(artifactId, section, "comment", comment.trim()); setComment(""); setShowComment(false); } }} disabled={!comment.trim()} className="rounded p-1 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-colors">
            <SendHorizontal className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function ArtifactCard({
  artifact,
  projectId,
  color,
  isReviewMode = false,
  feedback = [],
  onSubmitFeedback,
}: {
  artifact: Artifact;
  projectId: string;
  color: string;
  isReviewMode?: boolean;
  feedback?: PhaseFeedback[];
  onSubmitFeedback?: (artifactId: string, section: string, type: FeedbackType, comment?: string) => void;
}) {
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(isReviewMode);
  const [isEditing, setIsEditing] = useState(false);
  const content = stripCodeFences(artifact.markdown_content || "");
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewLines = content.split("\n").filter((l) => l.trim()).slice(0, 4).join("\n");

  const thumbsDownCount = feedback.filter((f) => f.feedback_type === "thumbs_down").length;
  const thumbsUpCount = feedback.filter((f) => f.feedback_type === "thumbs_up").length;
  const commentCount = feedback.filter((f) => f.feedback_type === "comment").length;
  const hasThumbsDown = thumbsDownCount > 0;
  const hasThumbsUp = thumbsUpCount > 0 && !hasThumbsDown;

  async function handleSave() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await api.phases.updateArtifact(token, projectId, artifact.id, { markdown_content: editContent });
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* error */ } finally { setSaving(false); }
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sections = isReviewMode && !isEditing ? extractSections(content) : [];

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-200 border bg-card ${
        hasThumbsDown ? "ring-1 ring-red-500/30 border-border" : hasThumbsUp ? "ring-1 ring-green-500/30 border-border" : isOpen ? "border-border" : "border-border"
      }`}
      style={isOpen ? { boxShadow: `0 2px 20px -4px ${color}12, 0 0px 6px -2px ${color}08` } : undefined}
    >
      <div>
        {/* Header */}
        <button
          onClick={() => { setIsOpen(!isOpen); setIsEditing(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18`, color }}>
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{artifact.title}</h3>
            <p className="text-[11px] text-muted-foreground">{artifact.agent_name}</p>
          </div>
          {feedback.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 mr-1">
              {thumbsUpCount > 0 && <span className="inline-flex items-center gap-0.5 text-[9px] text-green-400"><ThumbsUp className="h-2.5 w-2.5" />{thumbsUpCount}</span>}
              {thumbsDownCount > 0 && <span className="inline-flex items-center gap-0.5 text-[9px] text-red-400"><ThumbsDown className="h-2.5 w-2.5" />{thumbsDownCount}</span>}
              {commentCount > 0 && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400"><MessageSquare className="h-2.5 w-2.5" />{commentCount}</span>}
            </div>
          )}
          {saved && <span className="flex items-center gap-1 text-[10px] text-green-400 shrink-0"><Check className="h-2.5 w-2.5" /> Saved</span>}
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>

        {/* Preview */}
        {!isOpen && previewLines && (
          <div className="px-4 pb-3 -mt-0.5">
            <div className="prose prose-sm prose-invert max-w-none prose-p:text-[11px] prose-p:my-0.5 prose-p:text-muted-foreground prose-headings:text-[11px] prose-headings:my-0 prose-li:text-[11px] prose-li:my-0 prose-ul:my-0 prose-ol:my-0">
              <ReactMarkdown>{previewLines}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Expanded */}
        {isOpen && (
          <div className="border-t border-border">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-card/50 border-b border-border/60">
              <span className="text-[10px] text-muted-foreground/60 font-mono tracking-wide">plaintext</span>
              <div className="flex items-center gap-0.5">
                <button onClick={handleCopy} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                {isEditing ? (
                  <>
                    <button onClick={() => { setEditContent(content); setIsEditing(false); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors">
                      <RotateCcw className="h-2.5 w-2.5" /> Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                      {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                      Save
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setEditContent(content); setIsEditing(true); }} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <Pencil className="h-2.5 w-2.5" /> Edit
                  </button>
                )}
                <button onClick={() => { setIsOpen(false); setIsEditing(false); }} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Content */}
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[400px] bg-card/50 p-5 text-sm text-foreground font-mono leading-relaxed resize-none outline-none"
                spellCheck={false}
              />
            ) : isReviewMode && sections.length > 0 ? (
              <div className="px-5 py-4 max-h-[600px] overflow-y-auto">
                {/* Artifact title from first section if it has no heading */}
                {sections.length > 0 && sections[0].heading && (
                  <h3 className="text-sm font-semibold text-foreground mb-3">{artifact.title}</h3>
                )}
                <div className="space-y-0.5">
                  {sections.map((sec, idx) => {
                    const sectionFb = feedback.filter((f) => f.section === sec.heading);
                    const sectionHasDown = sectionFb.some((f) => f.feedback_type === "thumbs_down");
                    const sectionHasUp = sectionFb.some((f) => f.feedback_type === "thumbs_up") && !sectionHasDown;
                    const sectionComments = sectionFb.filter((f) => f.feedback_type === "comment");
                    return (
                      <div key={idx}>
                        {sec.heading && (
                          <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent ${sectionHasDown ? "bg-red-500/[0.03]" : sectionHasUp ? "bg-green-500/[0.03]" : ""}`}>
                            <span className="text-sm text-foreground">{sec.heading}</span>
                            {onSubmitFeedback ? (
                              <SectionFeedbackControls section={sec.heading} artifactId={artifact.id} feedback={feedback} onSubmit={onSubmitFeedback} />
                            ) : sectionFb.length > 0 ? (
                              <div className="flex items-center gap-1 shrink-0">
                                {sectionHasUp && <ThumbsUp className="h-3 w-3 text-green-400" />}
                                {sectionHasDown && <ThumbsDown className="h-3 w-3 text-red-400" />}
                                {sectionComments.length > 0 && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400"><MessageSquare className="h-2.5 w-2.5" />{sectionComments.length}</span>}
                              </div>
                            ) : null}
                          </div>
                        )}
                        {sec.content.trim() && (
                          <div className="px-3 py-2">
                            <div className="prose prose-sm prose-invert max-w-none prose-p:text-sm prose-p:text-foreground prose-p:leading-relaxed prose-p:my-2 prose-li:text-sm prose-li:text-foreground prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-strong:text-foreground prose-strong:font-semibold prose-code:text-emerald-300 prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-mono prose-pre:bg-card prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-3 prose-a:text-emerald-400 prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-l-2 prose-blockquote:border-emerald-500/30 prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-table:text-xs prose-th:text-foreground prose-td:text-muted-foreground">
                              <ReactMarkdown>{sec.content}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                        {!onSubmitFeedback && sectionComments.length > 0 && (
                          <div className="mt-0.5 ml-3 mb-1 space-y-0.5">
                            {sectionComments.map((c) => (
                              <div key={c.id} className="text-[10px] text-muted-foreground bg-card rounded px-2 py-1 border-l-2 border-blue-500/20">{c.comment}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : content ? (
              <div className="px-5 py-4 max-h-[600px] overflow-y-auto">
                <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-lg prose-h1:mb-3 prose-h1:mt-1 prose-h2:text-base prose-h2:mb-2 prose-h2:mt-5 prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h3:text-sm prose-h3:mb-1.5 prose-h3:mt-3 prose-p:text-sm prose-p:text-foreground prose-p:leading-relaxed prose-p:my-2 prose-li:text-sm prose-li:text-foreground prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-strong:text-foreground prose-strong:font-semibold prose-code:text-emerald-300 prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-mono prose-pre:bg-card prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-3 prose-a:text-emerald-400 prose-a:underline prose-a:underline-offset-2 prose-blockquote:border-l-2 prose-blockquote:border-emerald-500/30 prose-blockquote:pl-4 prose-blockquote:text-muted-foreground prose-table:text-xs prose-th:text-foreground prose-td:text-muted-foreground">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-muted-foreground">No content available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
