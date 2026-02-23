"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, type Project, ApiError } from "@/lib/api";
import { formatRelative, STATUS_COLORS, PHASE_LABELS } from "@/lib/utils";
import { Plus, FolderOpen, Rocket, ArrowRight, Trash2, Crown, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: "Free", cls: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", cls: "bg-brand-600/20 text-brand-300 border border-brand-500/30" },
  team: { label: "Team", cls: "bg-purple-600/20 text-purple-300 border border-purple-500/30" },
};

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

  useEffect(() => {
    if (token) {
      loadProjects();
      refreshUser();
    }
  }, [token]);

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

  const plan = user?.plan || "free";
  const badge = PLAN_BADGE[plan] || PLAN_BADGE.free;
  const limitLabel = user?.project_limit === -1 ? "Unlimited" : `${total}/${user?.project_limit ?? 1}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{limitLabel} projects</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan === "free" && (
            <button
              onClick={() => router.push("/dashboard/settings")}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-600/10 px-3 py-2 text-xs font-medium text-brand-300 hover:bg-brand-600/20 transition-colors"
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
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start by submitting your first idea
          </p>
          <button onClick={handleNewProject} className="btn-primary mt-6">
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="card-hover group relative">
              <Link href={`/project/${project.id}`} className="block">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground truncate pr-8 group-hover:text-brand-300 transition-colors">
                    {project.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.draft}`}
                  >
                    {project.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {project.raw_idea}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {project.current_phase
                      ? PHASE_LABELS[project.current_phase] || project.current_phase
                      : "Not started"}
                  </span>
                  <span>{formatRelative(project.created_at)}</span>
                </div>
              </Link>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!token || !window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
                  try {
                    await api.projects.delete(token, project.id);
                    loadProjects();
                    refreshUser();
                  } catch { /* ignore */ }
                }}
                className="absolute top-4 right-4 rounded-lg p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 transition-all"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UpgradeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  return (
    <DialogContent className="max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500">
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600">
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
