"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, type Project, ApiError } from "@/lib/api";
import { formatRelative, PHASE_LABELS } from "@/lib/utils";
import {
  Plus, FolderOpen, Rocket, ArrowRight, Trash2, Crown, Zap,
  Sparkles, MoreVertical, ExternalLink, Diamond, Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: "FREE", cls: "bg-secondary text-muted-foreground border border-border" },
  pro: { label: "PRO", cls: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30" },
  team: { label: "TEAM", cls: "bg-teal-600/20 text-teal-300 border border-teal-500/30" },
};

const CARD_COLORS = [
  { bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.25)", accent: "#06b6d4", iconBg: "rgba(6,182,212,0.15)" },
  { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", accent: "#10b981", iconBg: "rgba(16,185,129,0.15)" },
  { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)", accent: "#8b5cf6", iconBg: "rgba(139,92,246,0.15)" },
  { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", accent: "#f59e0b", iconBg: "rgba(245,158,11,0.15)" },
  { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", accent: "#3b82f6", iconBg: "rgba(59,130,246,0.15)" },
  { bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)", accent: "#ec4899", iconBg: "rgba(236,72,153,0.15)" },
  { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)", accent: "#a855f7", iconBg: "rgba(168,85,247,0.15)" },
  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", accent: "#22c55e", iconBg: "rgba(34,197,94,0.15)" },
];

function getProjectStatus(project: Project): { label: string; dotCls: string; textCls: string; bgCls: string } {
  if (project.status === "completed") return { label: "Completed", dotCls: "bg-emerald-400", textCls: "text-emerald-400", bgCls: "bg-emerald-500/15" };
  if (project.current_phase) return { label: "In progress", dotCls: "bg-green-400", textCls: "text-green-400", bgCls: "bg-green-500/15" };
  return { label: "Not started", dotCls: "bg-slate-400", textCls: "text-slate-400", bgCls: "bg-slate-500/10" };
}

export default function DashboardPage() {
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadProjects();
      refreshUser();
    }
  }, [token]);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick() { setOpenMenuId(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuId]);

  async function loadProjects() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.projects.list(token);
      setProjects(res.projects);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  function handleNewProject() {
    if (user && user.project_limit !== -1 && total >= user.project_limit) {
      setShowUpgrade(true);
    } else {
      setShowCreate(true);
    }
  }

  async function handleDelete(project: Project) {
    if (!token || !window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.projects.delete(token, project.id);
      loadProjects();
      refreshUser();
    } catch { /* ignore */ }
  }

  const plan = user?.plan || "free";
  const badge = PLAN_BADGE[plan] || PLAN_BADGE.free;
  const limitLabel = user?.project_limit === -1 ? "Unlimited" : `${total}/${user?.project_limit ?? 1}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{limitLabel} projects</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan === "free" && (
            <button
              onClick={() => router.push("/dashboard/settings")}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-600/10 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-600/20 transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade
            </button>
          )}
          <button onClick={handleNewProject} className="btn-primary">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <CreateProjectDialog
          onCreated={() => {
            setShowCreate(false);
            loadProjects();
            refreshUser();
          }}
        />
      </Dialog>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <UpgradeDialog onClose={() => setShowUpgrade(false)} />
      </Dialog>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent border border-border">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-5 text-lg font-semibold text-foreground">No projects yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Start by submitting your first idea
          </p>
          <button onClick={handleNewProject} className="btn-primary mt-6">
            <Sparkles className="h-4 w-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, idx) => {
            const colors = CARD_COLORS[idx % CARD_COLORS.length];
            const pStatus = getProjectStatus(project);

            return (
              <div
                key={project.id}
                className="group relative rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                }}
              >
                {/* 3-dot menu */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenMenuId(openMenuId === project.id ? null : project.id);
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {openMenuId === project.id && (
                    <div className="absolute right-0 mt-1 w-36 rounded-xl border border-border bg-card py-1 z-20" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          router.push(`/project/${project.id}`);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          handleDelete(project);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <Link href={`/project/${project.id}`} className="block p-5">
                  {/* Title row */}
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: colors.iconBg, color: colors.accent }}
                    >
                      <Rocket className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-foreground truncate pr-6">
                      {project.name}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {project.raw_idea}
                  </p>

                  {/* Domain & audience */}
                  <div className="mt-4 space-y-1.5">
                    {project.domain && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Diamond className="h-3 w-3 shrink-0" style={{ color: colors.accent }} />
                        <span>{project.domain}</span>
                      </div>
                    )}
                    {project.target_audience && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" style={{ color: colors.accent }} />
                        <span>{project.target_audience}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer: status + time */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${pStatus.bgCls} ${pStatus.textCls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${pStatus.dotCls}`} />
                      {pStatus.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatRelative(project.created_at)}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpgradeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  return (
    <DialogContent className="max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500">
        <Zap className="h-7 w-7 text-white" />
      </div>
      <DialogHeader className="text-center">
        <DialogTitle className="text-xl">Project limit reached</DialogTitle>
        <DialogDescription>
          Your free plan allows 1 project. Upgrade to Pro for up to 5 projects, or Team for unlimited.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 flex flex-col gap-2">
        <button
          onClick={() => { onClose(); router.push("/dashboard/settings"); }}
          className="btn-primary w-full"
        >
          <Crown className="h-4 w-4" />
          View Plans & Upgrade
        </button>
        <button onClick={onClose} className="btn-ghost w-full">
          Cancel
        </button>
      </div>
    </DialogContent>
  );
}

function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const token = useAuth((s) => s.accessToken);
  const [name, setName] = useState("");
  const [rawIdea, setRawIdea] = useState("");
  const [domain, setDomain] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      await api.projects.create(token, {
        name,
        raw_idea: rawIdea,
        domain: domain || undefined,
        target_audience: targetAudience || undefined,
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError("Project limit reached. Please upgrade your plan.");
      } else {
        setError("Failed to create project. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
            <Rocket className="h-4 w-4 text-white -rotate-45" />
          </div>
          <DialogTitle>New Project</DialogTitle>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
        )}
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-foreground">
            Project name
          </label>
          <input
            id="project-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My SaaS Idea"
            className="input-field mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="raw-idea" className="block text-sm font-medium text-foreground">
            Describe your idea
          </label>
          <textarea
            id="raw-idea"
            required
            rows={4}
            minLength={10}
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            placeholder="An AI-powered tool that helps developers..."
            className="input-field mt-1.5 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-foreground">
              Domain
            </label>
            <input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. DevTools"
              className="input-field mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="audience" className="block text-sm font-medium text-foreground">
              Target audience
            </label>
            <input
              id="audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Indie devs"
              className="input-field mt-1.5"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <DialogClose asChild>
            <button type="button" className="btn-ghost">
              Cancel
            </button>
          </DialogClose>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating..." : "Create Project"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
