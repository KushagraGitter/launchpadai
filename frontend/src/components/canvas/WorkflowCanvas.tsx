"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Lightbulb,
  FileText,
  Code2,
  Rocket,
  Lock,
  Bot,
  Pencil,
  Save,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  Layers,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, Phase, Artifact, PhaseDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface WorkflowCanvasProps {
  projectId: string;
  refreshTrigger?: number;
}

type PhaseStatus = "locked" | "pending" | "queued" | "running" | "completed" | "failed";

const PHASE_DEFS = [
  { type: "validation", label: "Idea Validation", icon: "lightbulb", color: "#f59e0b", downloadable: false },
  { type: "prd", label: "PRD Generation", icon: "filetext", color: "#3b82f6", downloadable: true },
  { type: "coding_context", label: "Coding Context", icon: "code", color: "#22c55e", downloadable: true },
  { type: "gtm", label: "Go-to-Market", icon: "rocket", color: "#a855f7", downloadable: true },
];

function PhaseIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || "h-5 w-5";
  switch (icon) {
    case "lightbulb": return <Lightbulb className={cls} />;
    case "filetext": return <FileText className={cls} />;
    case "code": return <Code2 className={cls} />;
    case "rocket": return <Rocket className={cls} />;
    default: return <Circle className={cls} />;
  }
}

function StatusIcon({ status }: { status: PhaseStatus }) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin text-brand-400" />;
    case "queued": return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-400" />;
    case "pending": return <Circle className="h-4 w-4 text-muted-foreground" />;
    default: return <Lock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  completed: "Complete",
  running: "Running",
  queued: "Queued",
  failed: "Failed",
  pending: "Ready",
  locked: "Locked",
};

// ─── Phase Node ───

interface PhaseNodeData {
  phaseType: string;
  label: string;
  icon: string;
  color: string;
  status: PhaseStatus;
  phaseIndex: number;
  agents: string[];
  projectId: string;
  downloadable: boolean;
  artifactCount: number;
  isExpanded: boolean;
  isDimmed: boolean;
  onSelect: (phaseType: string) => void;
  onRerun: (phaseType: string) => void;
  onDownload: (phaseType: string) => void;
}

function PhaseNodeComponent({ data }: NodeProps<PhaseNodeData>) {
  const [rerunning, setRerunning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const canRerun = data.status === "completed" || data.status === "failed";
  const canDownload = data.downloadable && data.status === "completed";
  const hasArtifacts = data.artifactCount > 0;

  function handleClick() {
    data.onSelect(data.phaseType);
  }

  function handleRerun(e: React.MouseEvent) {
    e.stopPropagation();
    if (rerunning) return;
    setRerunning(true);
    data.onRerun(data.phaseType);
    setTimeout(() => setRerunning(false), 3000);
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    data.onDownload(data.phaseType);
    setTimeout(() => setDownloading(false), 5000);
  }

  const borderColor = data.isExpanded
    ? data.color
    : data.status === "completed"
    ? "#22c55e"
    : data.status === "running"
    ? "#6366f1"
    : data.status === "queued"
    ? "#f59e0b"
    : data.status === "failed"
    ? "#ef4444"
    : "#27272a";

  const ringClass = data.isExpanded
    ? "ring-2"
    : data.status === "running" || data.status === "queued"
    ? "ring-2"
    : "";

  return (
    <div
      onClick={handleClick}
      className={`rounded-2xl border-2 bg-card w-[260px] cursor-pointer select-none transition-all duration-300 ${ringClass}`}
      style={{
        borderColor: `${borderColor}80`,
        boxShadow: data.isExpanded
          ? `0 0 24px ${data.color}20, 0 4px 12px rgba(0,0,0,0.3)`
          : data.status === "running"
          ? `0 0 20px ${borderColor}15`
          : "0 2px 8px rgba(0,0,0,0.2)",
        opacity: data.isDimmed ? 0.45 : 1,
        transform: data.isExpanded ? "scale(1.02)" : "scale(1)",
        ...({ "--tw-ring-color": data.isExpanded ? `${data.color}30` : `${borderColor}20` } as React.CSSProperties),
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />

      {/* Header */}
      <div
        className="rounded-t-[14px] px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: `${data.color}12` }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{ backgroundColor: `${data.color}20`, color: data.color }}
        >
          <PhaseIcon icon={data.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: data.color }}>
            Phase {data.phaseIndex + 1}
          </span>
          <h3 className={`text-sm font-bold leading-tight ${data.status === "locked" ? "text-muted-foreground" : "text-foreground"}`}>
            {data.label}
          </h3>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={data.status} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            data.status === "completed" ? "text-green-400" :
            data.status === "running" ? "text-brand-300" :
            data.status === "queued" ? "text-amber-400" :
            data.status === "failed" ? "text-red-400" :
            "text-muted-foreground"
          }`}>
            {STATUS_LABEL[data.status]}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="nodrag rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              title="Download artifacts"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
          {canRerun && (
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="nodrag rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              title="Re-run phase"
            >
              {rerunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Active agents (only during run) */}
      {(data.status === "running" || data.status === "queued") && data.agents.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50 space-y-1">
          {data.agents.map((a) => (
            <div key={a} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable artifact indicator */}
      {hasArtifacts && data.status !== "running" && data.status !== "queued" && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-t transition-colors"
          style={{ borderColor: `${data.color}15` }}
        >
          <Layers className="h-3.5 w-3.5" style={{ color: `${data.color}90` }} />
          <span className="text-[10px] text-muted-foreground flex-1">
            {data.artifactCount} artifact{data.artifactCount !== 1 ? "s" : ""}
          </span>
          {data.isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform" />
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

// ─── Artifact Card Node ───

interface ArtifactNodeData {
  artifact: Artifact;
  projectId: string;
  color: string;
  phaseType: string;
  phaseLabel: string;
  animDelay: number;
}

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

// ─── Platform & Builder Action Links ───

const SOCIAL_PLATFORMS = [
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/post/new",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    color: "#0A66C2",
  },
  {
    name: "X (Twitter)",
    url: "https://x.com/compose/post",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: "#fff",
  },
  {
    name: "Reddit",
    url: "https://www.reddit.com/submit",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
    color: "#FF4500",
  },
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com/posts/new",
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.604 8.4h-3.405V12h3.405a1.8 1.8 0 0 0 0-3.6zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.801V6h5.804a4.2 4.2 0 0 1 0 8.4z"/>
      </svg>
    ),
    color: "#DA552F",
  },
];

const BUILDER_TOOLS = [
  { name: "Lovable", url: "https://lovable.dev", color: "#FF6B6B" },
  { name: "v0", url: "https://v0.dev", color: "#fff" },
  { name: "Bolt", url: "https://bolt.new", color: "#FFDD00" },
];

function ArtifactActionBar({ phaseType, agentName }: { phaseType: string; agentName: string }) {
  if (phaseType !== "gtm") return null;

  const agentLower = agentName.toLowerCase();
  const isContentCreator = agentLower.includes("content") || agentLower.includes("marketing");
  const isPositioning = agentLower.includes("position") || agentLower.includes("launch") || agentLower.includes("channel");

  const showSocial = isContentCreator || isPositioning;
  const showBuilders = isContentCreator || isPositioning;

  if (!showSocial && !showBuilders) return null;

  return (
    <div className="border-t border-border/30 px-3.5 py-2.5 space-y-2">
      {showSocial && (
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
            Post to platform
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SOCIAL_PLATFORMS.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="nodrag flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[10px] text-foreground hover:border-border hover:bg-accent transition-all group"
                title={`Create post on ${p.name}`}
              >
                <span style={{ color: p.color }} className="group-hover:scale-110 transition-transform">
                  {p.icon}
                </span>
                {p.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}
      {showBuilders && (
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
            Build landing page
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BUILDER_TOOLS.map((tool) => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="nodrag flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[10px] text-foreground hover:border-border hover:bg-accent transition-all group"
                title={`Build with ${tool.name}`}
              >
                <span className="font-bold text-[10px] group-hover:scale-110 transition-transform" style={{ color: tool.color }}>
                  {tool.name === "v0" ? "v0" : tool.name === "Bolt" ? "⚡" : "♥"}
                </span>
                {tool.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactNodeComponent({ data, id }: NodeProps<ArtifactNodeData>) {
  const { getToken } = useAuth();
  const reactFlow = useReactFlow();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(
    stripCodeFences(data.artifact.markdown_content || "")
  );
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Sync content when artifact data changes (async fetch)
  useEffect(() => {
    if (data.artifact.markdown_content && !isEditing) {
      const cleaned = stripCodeFences(data.artifact.markdown_content);
      if (cleaned !== content) {
        setContent(cleaned);
      }
    }
  }, [data.artifact.markdown_content]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), (data.animDelay || 0) * 80);
    return () => clearTimeout(timer);
  }, [data.animDelay]);

  // Bring expanded card to front via zIndex
  useEffect(() => {
    reactFlow.setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, zIndex: isOpen ? 1000 : 0 } : n
      )
    );
  }, [isOpen, id, reactFlow]);

  const previewContent = content
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 6)
    .join("\n");

  async function handleSave() {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await api.phases.updateArtifact(token, data.projectId, data.artifact.id, {
        markdown_content: editContent,
      });
      setContent(editContent);
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl border bg-card transition-all duration-300 overflow-hidden"
      style={{
        borderColor: `${data.color}40`,
        width: isOpen ? 480 : 240,
        maxHeight: isOpen ? (data.phaseType === "gtm" ? 680 : 560) : undefined,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateX(0)" : "translateX(-16px)",
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />

      <div
        className="px-3.5 py-2.5 flex items-center gap-2.5 cursor-pointer select-none"
        style={{ backgroundColor: `${data.color}10` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <FileText className="h-4 w-4 shrink-0" style={{ color: data.color }} />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-foreground truncate">{data.artifact.title}</h4>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: `${data.color}cc` }}>
            {data.artifact.agent_name}
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-0.5 text-[9px] text-green-400 shrink-0">
            <Check className="h-2.5 w-2.5" /> Saved
          </span>
        )}
      </div>

      {!isOpen && previewContent && (
        <div className="px-3.5 py-2 border-t border-border/30 max-h-[72px] overflow-hidden relative">
            <div className="prose prose-sm prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-semibold
            prose-h1:text-[11px] prose-h2:text-[11px] prose-h3:text-[10px]
            prose-h1:my-0 prose-h2:my-0 prose-h3:my-0
            prose-p:text-[10px] prose-p:text-muted-foreground prose-p:leading-snug prose-p:my-0.5
            prose-li:text-[10px] prose-li:text-muted-foreground prose-li:my-0
            prose-ul:my-0 prose-ol:my-0 prose-ul:pl-3 prose-ol:pl-3
            prose-strong:text-foreground prose-strong:font-semibold
            prose-code:text-brand-300 prose-code:text-[9px]
            prose-hr:hidden">
            <ReactMarkdown>{previewContent}</ReactMarkdown>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}

      {isOpen && (
        <div className="border-t border-border/30">
          <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-b border-border/30">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              {data.phaseLabel}
            </span>
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditContent(content); setIsEditing(false); }}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Cancel
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSave(); }}
                    disabled={saving}
                    className="flex items-center gap-1 rounded bg-brand-600 px-2 py-0.5 text-[10px] text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditContent(content); setIsEditing(true); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Pencil className="h-2.5 w-2.5" /> Edit
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsEditing(false); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="nowheel nodrag w-full h-[400px] bg-secondary p-3 text-[11px] text-foreground font-mono leading-relaxed resize-none outline-none"
              spellCheck={false}
            />
          ) : content ? (
            <div className="nowheel nodrag px-4 py-3 max-h-[440px] overflow-y-auto">
              <div className="prose prose-sm prose-invert max-w-none
                prose-headings:text-foreground prose-headings:font-bold prose-headings:tracking-tight
                prose-h1:text-base prose-h1:mb-3 prose-h1:mt-1
                prose-h2:text-sm prose-h2:mb-2 prose-h2:mt-4 prose-h2:border-b prose-h2:border-border/40 prose-h2:pb-1.5
                prose-h3:text-xs prose-h3:mb-1.5 prose-h3:mt-3 prose-h3:text-foreground
                prose-p:text-xs prose-p:text-foreground prose-p:leading-relaxed prose-p:my-1.5
                prose-li:text-xs prose-li:text-foreground prose-li:my-0.5
                prose-ul:my-1.5 prose-ol:my-1.5
                prose-strong:text-foreground prose-strong:font-semibold
                prose-em:text-muted-foreground prose-em:italic
                prose-code:text-brand-300 prose-code:bg-muted/80 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[10px] prose-code:font-mono
                prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-2
                prose-a:text-brand-400 prose-a:underline prose-a:underline-offset-2
                prose-blockquote:border-l-2 prose-blockquote:border-brand-500/40 prose-blockquote:pl-3 prose-blockquote:text-muted-foreground prose-blockquote:italic
                prose-hr:border-border/50 prose-hr:my-3
                prose-table:text-[10px] prose-th:text-foreground prose-th:font-semibold prose-td:text-muted-foreground">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No content available</p>
            </div>
          )}

          <ArtifactActionBar phaseType={data.phaseType} agentName={data.artifact.agent_name} />
        </div>
      )}
    </div>
  );
}

// ─── Node types ───

const nodeTypes = {
  phaseNode: PhaseNodeComponent,
  artifactNode: ArtifactNodeComponent,
};

// ─── Agent lookup ───

const AGENTS: Record<string, string[]> = {
  validation: ["Market Analyst", "Feasibility Analyst", "Persona Researcher", "Synthesizer"],
  prd: ["Requirements Analyst", "Prioritizer", "UX Designer", "PRD Writer"],
  coding_context: ["Architect", "Schema Designer", "Task Decomposer", "Packager"],
  gtm: ["Positioning", "Channels", "Content Creator", "Launch Planner"],
};

// ─── Inner Canvas (needs ReactFlowProvider wrapping) ───

function WorkflowCanvasInner({ projectId, refreshTrigger }: WorkflowCanvasProps) {
  const { getToken } = useAuth();
  const reactFlowInstance = useReactFlow();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [artifactsByPhase, setArtifactsByPhase] = useState<Record<string, Artifact[]>>({});
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const prevExpandedRef = useRef<string | null>(null);
  const prevNodeIdsRef = useRef<string>("");

  const fetchPhases = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await api.phases.list(token, projectId);
      setPhases(data);

      const completedPhases = data.filter((p) => p.status === "completed");
      for (const cp of completedPhases) {
        if (!artifactsByPhase[cp.phase_type]) {
          try {
            const detail = await api.phases.detail(token, projectId, cp.phase_type);
            setArtifactsByPhase((prev) => ({ ...prev, [cp.phase_type]: detail.artifacts }));
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch phases:", err);
    }
  }, [projectId, getToken]);

  useEffect(() => {
    fetchPhases();
    const interval = setInterval(fetchPhases, 6000);
    return () => clearInterval(interval);
  }, [fetchPhases, refreshTrigger]);

  const handleRerun = useCallback(async (phaseType: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await api.phases.run(token, projectId, phaseType);
      setArtifactsByPhase((prev) => {
        const next = { ...prev };
        delete next[phaseType];
        return next;
      });
      setExpandedPhase(null);
      fetchPhases();
    } catch (err) {
      console.error("Rerun failed:", err);
    }
  }, [projectId, getToken, fetchPhases]);

  const handleDownload = useCallback(async (phaseType: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await api.phases.exportZip(token, projectId, phaseType);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [projectId, getToken]);

  const handleSelectPhase = useCallback((phaseType: string) => {
    setExpandedPhase((prev) => (prev === phaseType ? null : phaseType));
  }, []);

  const handlePaneClick = useCallback(() => {
    setExpandedPhase(null);
  }, []);

  const completedCount = phases.filter((p) => p.status === "completed").length;

  // Build desired nodes + edges from current state
  const { desiredNodes, desiredEdges, nodeIdKey } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const PHASE_X = 80;
    const PHASE_Y_START = 60;
    const PHASE_GAP_Y = 180;

    PHASE_DEFS.forEach((def, idx) => {
      const phase = phases.find((p) => p.phase_type === def.type);
      let status: PhaseStatus = "locked";
      if (phase) {
        status = phase.status as PhaseStatus;
      } else if (idx === 0 || phases.some((p) => p.phase_type === PHASE_DEFS[idx - 1]?.type && p.status === "completed")) {
        status = "pending";
      }

      const phaseY = PHASE_Y_START + idx * PHASE_GAP_Y;
      const artifacts = artifactsByPhase[def.type] || [];
      const isExpanded = expandedPhase === def.type;
      const isDimmed = expandedPhase !== null && expandedPhase !== def.type;

      nodes.push({
        id: def.type,
        type: "phaseNode",
        position: { x: PHASE_X, y: phaseY },
        data: {
          phaseType: def.type,
          label: def.label,
          icon: def.icon,
          color: def.color,
          status,
          phaseIndex: idx,
          agents: AGENTS[def.type] || [],
          projectId,
          downloadable: def.downloadable,
          artifactCount: artifacts.length,
          isExpanded,
          isDimmed,
          onSelect: handleSelectPhase,
          onRerun: handleRerun,
          onDownload: handleDownload,
        } as PhaseNodeData,
      });

      if (idx > 0) {
        const prevDef = PHASE_DEFS[idx - 1];
        const prevCompleted = phases.some((p) => p.phase_type === prevDef.type && p.status === "completed");
        edges.push({
          id: `${prevDef.type}->${def.type}`,
          source: prevDef.type,
          target: def.type,
          type: ConnectionLineType.SmoothStep,
          animated: prevCompleted && !expandedPhase,
          style: {
            stroke: prevCompleted ? "#22c55e" : "#27272a",
            strokeWidth: 2,
            opacity: isDimmed ? 0.25 : 1,
          },
        });
      }

      if (isExpanded && artifacts.length > 0) {
        const ARTIFACT_X = PHASE_X + 360;
        const ART_GAP_Y = 140;
        const totalArtHeight = (artifacts.length - 1) * ART_GAP_Y;
        const artStartY = phaseY - totalArtHeight / 2;

        artifacts.forEach((artifact, aIdx) => {
          const artNodeId = `artifact-${artifact.id}`;
          nodes.push({
            id: artNodeId,
            type: "artifactNode",
            position: {
              x: ARTIFACT_X,
              y: artStartY + aIdx * ART_GAP_Y,
            },
            data: {
              artifact,
              projectId,
              color: def.color,
              phaseType: def.type,
              phaseLabel: def.label,
              animDelay: aIdx,
            } as ArtifactNodeData,
          });

          edges.push({
            id: `${def.type}->${artNodeId}`,
            source: def.type,
            sourceHandle: "right",
            target: artNodeId,
            type: ConnectionLineType.SmoothStep,
            animated: false,
            style: {
              stroke: `${def.color}60`,
              strokeWidth: 1.5,
              strokeDasharray: "6 4",
            },
          });
        });
      }
    });

    const idKey = nodes.map((n) => n.id).sort().join(",");
    return { desiredNodes: nodes, desiredEdges: edges, nodeIdKey: idKey };
  }, [phases, artifactsByPhase, projectId, expandedPhase, handleSelectPhase, handleRerun, handleDownload]);

  const [nodes, setNodes, onNodesChange] = useNodesState(desiredNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(desiredEdges);

  useEffect(() => {
    const structureChanged = nodeIdKey !== prevNodeIdsRef.current;
    prevNodeIdsRef.current = nodeIdKey;

    if (structureChanged) {
      // Nodes were added or removed (expand/collapse or new phase) — full layout reset
      setNodes(desiredNodes);
    } else {
      // Only data changed (status poll) — update data in place, preserve positions
      setNodes((currentNodes) =>
        currentNodes.map((existingNode) => {
          const desired = desiredNodes.find((n) => n.id === existingNode.id);
          if (!desired) return existingNode;
          return { ...existingNode, data: desired.data };
        })
      );
    }

    setEdges(desiredEdges);
  }, [desiredNodes, desiredEdges, nodeIdKey, setNodes, setEdges]);

  // Fit view only when expandedPhase actually changes, not on data polls
  useEffect(() => {
    if (prevExpandedRef.current === expandedPhase) return;
    prevExpandedRef.current = expandedPhase;

    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
    }, 150);
    return () => clearTimeout(timer);
  }, [expandedPhase, reactFlowInstance]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Canvas</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {completedCount}/{PHASE_DEFS.length} phases
          </span>
          {expandedPhase && (
            <button
              onClick={() => setExpandedPhase(null)}
              className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Collapse
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-purple-500 transition-all duration-700"
              style={{ width: `${(completedCount / PHASE_DEFS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Math.round((completedCount / PHASE_DEFS.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          panOnDrag
          zoomOnScroll
          nodesConnectable={false}
          elementsSelectable
          selectNodesOnDrag={false}
          defaultEdgeOptions={{ type: ConnectionLineType.SmoothStep }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1f1f23" />
          <Controls
            showInteractive={false}
            className="!bg-secondary !border-border !rounded-xl !shadow-lg [&>button]:!bg-secondary [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-accent [&>button:hover]:!text-foreground [&>button>svg]:!fill-current"
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "artifactNode") return node.data?.color || "#3f3f46";
              const st = node.data?.status;
              if (st === "completed") return "#22c55e";
              if (st === "running") return "#6366f1";
              return "#3f3f46";
            }}
            maskColor="rgba(9,9,11,0.8)"
            className="!bg-card !border-border !rounded-xl"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// ─── Main Export (wraps with ReactFlowProvider) ───

export default function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
