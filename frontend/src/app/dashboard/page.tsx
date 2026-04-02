"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
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

const PLAN_BADGE: Record<string, { label: string; cls: string; gradient: string }> = {
  free: { label: "FREE", cls: "text-zinc-400", gradient: "from-zinc-500/20 to-zinc-600/10 border-zinc-500/20" },
  pro: { label: "PRO", cls: "text-emerald-400", gradient: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30" },
  team: { label: "TEAM", cls: "text-violet-400", gradient: "from-violet-500/20 to-purple-500/10 border-violet-500/30" },
};

const CARD_COLORS = [
  { gradient: "from-cyan-500/15 to-blue-500/5", border: "border-cyan-500/20", accent: "#06b6d4", hoverGlow: "from-cyan-500/20 to-blue-500/10" },
  { gradient: "from-emerald-500/15 to-green-500/5", border: "border-emerald-500/20", accent: "#10b981", hoverGlow: "from-emerald-500/20 to-green-500/10" },
  { gradient: "from-violet-500/15 to-purple-500/5", border: "border-violet-500/20", accent: "#8b5cf6", hoverGlow: "from-violet-500/20 to-purple-500/10" },
  { gradient: "from-amber-500/15 to-orange-500/5", border: "border-amber-500/20", accent: "#f59e0b", hoverGlow: "from-amber-500/20 to-orange-500/10" },
  { gradient: "from-blue-500/15 to-indigo-500/5", border: "border-blue-500/20", accent: "#3b82f6", hoverGlow: "from-blue-500/20 to-indigo-500/10" },
  { gradient: "from-pink-500/15 to-rose-500/5", border: "border-pink-500/20", accent: "#ec4899", hoverGlow: "from-pink-500/20 to-rose-500/10" },
  { gradient: "from-purple-500/15 to-fuchsia-500/5", border: "border-purple-500/20", accent: "#a855f7", hoverGlow: "from-purple-500/20 to-fuchsia-500/10" },
  { gradient: "from-green-500/15 to-teal-500/5", border: "border-green-500/20", accent: "#22c55e", hoverGlow: "from-green-500/20 to-teal-500/10" },
];

function getProjectStatus(project: Project): { label: string; dotCls: string; textCls: string; bgCls: string } {
  if (project.status === "completed") return { label: "Completed", dotCls: "bg-emerald-400", textCls: "text-emerald-400", bgCls: "bg-emerald-500/15 border border-emerald-500/20" };
  if (project.current_phase) return { label: "In progress", dotCls: "bg-green-400", textCls: "text-green-400", bgCls: "bg-green-500/15 border border-green-500/20" };
  return { label: "Not started", dotCls: "bg-zinc-500", textCls: "text-zinc-400", bgCls: "bg-zinc-500/10 border border-zinc-500/15" };
}

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const { getToken, isSignedIn } = useClerkAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick() { setOpenMenuId(null); }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openMenuId]);

  async function loadProjects() {
    const token = await getToken();
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
    const token = await getToken();
    if (!token || !window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.projects.delete(token, project.id);
      loadProjects();
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
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm text-zinc-400">{limitLabel} projects</p>
            <span className={`inline-flex items-center rounded-lg bg-gradient-to-r ${badge.gradient} border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {plan === "free" && (
            <button
              onClick={() => router.push("/dashboard/settings")}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm px-4 py-2.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all duration-200"
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade
            </button>
          )}
          <button
            onClick={handleNewProject}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300"
          >
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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] backdrop-blur-xl">
            <FolderOpen className="h-9 w-9 text-zinc-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-white">No projects yet</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Start by submitting your first idea
          </p>
          <button
            onClick={handleNewProject}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300"
          >
            <Sparkles className="h-4 w-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, idx) => {
            const colors = CARD_COLORS[idx % CARD_COLORS.length];
            const pStatus = getProjectStatus(project);

            return (
              <div
                key={project.id}
                className={`group relative rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.gradient} backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden`}
              >
                {/* Hover glow */}
                <div className={`absolute top-0 right-0 h-32 w-32 rounded-full bg-gradient-to-bl ${colors.hoverGlow} blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                {/* 3-dot menu */}
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenMenuId(openMenuId === project.id ? null : project.id);
                    }}
                    className="rounded-lg p-1.5 text-zinc-500 opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-zinc-300 transition-all"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {openMenuId === project.id && (
                    <div className="absolute right-0 mt-1 w-40 rounded-xl border border-white/[0.08] bg-[#111318]/95 backdrop-blur-xl py-1 z-20 shadow-2xl shadow-black/40">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          router.push(`/project/${project.id}`);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-all"
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
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <Link href={`/project/${project.id}`} className="relative block p-6">
                  {/* Title row */}
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${colors.accent}20`, color: colors.accent }}
                    >
                      <Rocket className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-white truncate pr-8 text-base">
                      {project.name}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="mt-4 text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                    {project.raw_idea}
                  </p>

                  {/* Domain & audience */}
                  <div className="mt-4 space-y-2">
                    {project.domain && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Diamond className="h-3 w-3 shrink-0" style={{ color: colors.accent }} />
                        <span>{project.domain}</span>
                      </div>
                    )}
                    {project.target_audience && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Users className="h-3 w-3 shrink-0" style={{ color: colors.accent }} />
                        <span>{project.target_audience}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer: status + time */}
                  <div className="mt-5 flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium ${pStatus.bgCls} ${pStatus.textCls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${pStatus.dotCls}`} />
                      {pStatus.label}
                    </span>
                    <span className="text-[11px] text-zinc-600">
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
    <DialogContent className="max-w-md text-center !bg-[#111318] !border-white/[0.08]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl shadow-teal-500/20">
        <Zap className="h-8 w-8 text-white" />
      </div>
      <DialogHeader className="text-center">
        <DialogTitle className="text-xl text-white">Project limit reached</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Your free plan allows 1 project. Upgrade to Pro for up to 5 projects, or Team for unlimited.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 flex flex-col gap-2">
        <button
          onClick={() => { onClose(); router.push("/dashboard/settings"); }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300"
        >
          <Crown className="h-4 w-4" />
          View Plans & Upgrade
        </button>
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all">
          Cancel
        </button>
      </div>
    </DialogContent>
  );
}

function CreateProjectDialog({ onCreated }: { onCreated: () => void }) {
  const { getToken } = useClerkAuth();
  const [name, setName] = useState("");
  const [rawIdea, setRawIdea] = useState("");
  const [domain, setDomain] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = await getToken();
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
    <DialogContent className="max-w-lg !bg-[#111318] !border-white/[0.08]">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-lg shadow-teal-500/20">
            <Rocket className="h-5 w-5 text-white -rotate-45" />
          </div>
          <DialogTitle className="text-white text-lg">New Project</DialogTitle>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
        )}
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-zinc-300">
            Project name
          </label>
          <input
            id="project-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My SaaS Idea"
            className="mt-1.5 block w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all"
          />
        </div>
        <div>
          <label htmlFor="raw-idea" className="block text-sm font-medium text-zinc-300">
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
            className="mt-1.5 block w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30 resize-none transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="domain" className="block text-sm font-medium text-zinc-300">
              Domain
            </label>
            <input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. DevTools"
              className="mt-1.5 block w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all"
            />
          </div>
          <div>
            <label htmlFor="audience" className="block text-sm font-medium text-zinc-300">
              Target audience
            </label>
            <input
              id="audience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Indie devs"
              className="mt-1.5 block w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <DialogClose asChild>
            <button type="button" className="rounded-xl px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all">
              Cancel
            </button>
          </DialogClose>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Project"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
