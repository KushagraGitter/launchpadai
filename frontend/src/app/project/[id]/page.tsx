"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Rocket, Pencil, Sun, Moon, Bell } from "lucide-react";
import { api, Project, Phase } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import ChatPanel from "@/components/chat/ChatPanel";
import JourneyRail from "@/components/phases/JourneyRail";
import PhasePage from "@/components/phases/PhasePage";
import { useAgentProgress } from "@/lib/useAgentProgress";
import ProfileDropdown from "@/components/ui/ProfileDropdown";

const PHASE_ORDER = ["discovery", "validation", "prd", "coding_context", "gtm"];

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { getToken, user, loadUser, isLoading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(PHASE_ORDER[0]);

  const { progress } = useAgentProgress(projectId);
  const { resolved: themeMode, setTheme } = useTheme();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    async function fetchProject() {
      const token = getToken();
      if (!token) return;
      try {
        const data = await api.projects.get(token, projectId);
        setProject(data);
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchProject();
  }, [projectId, user, getToken, router]);

  const fetchPhases = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await api.phases.list(token, projectId);
      setPhases(data);
    } catch {
      // non-critical
    }
  }, [projectId, getToken]);

  useEffect(() => {
    if (user) {
      fetchPhases();
      const interval = setInterval(fetchPhases, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchPhases]);

  useEffect(() => {
    if (progress.isRunning && progress.phaseType) {
      setActivePhase(progress.phaseType);
    }
  }, [progress.isRunning, progress.phaseType]);

  useEffect(() => {
    if (!progress.isRunning && progress.completedAgents.length > 0) {
      setTimeout(fetchPhases, 1000);
    }
  }, [progress.isRunning, progress.completedAgents.length, fetchPhases]);

  const handlePhaseStarted = useCallback(() => {
    fetchPhases();
  }, [fetchPhases]);

  const runningPhase = phases.find(
    (p) => p.status === "running" || p.status === "queued"
  );
  const reviewPhase = !runningPhase
    ? phases.find((p) => p.status === "in_review")
    : null;

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
            <Rocket className="h-3.5 w-3.5 text-white -rotate-45" />
          </div>
          <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">
            {project.name}
          </h1>
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Edit project">
            <Pencil className="h-3 w-3" />
          </button>
          {project.domain && (
            <span className="rounded-full bg-accent border border-border px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
              {project.domain}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {runningPhase && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">
                Working on it...
              </span>
            </div>
          )}
          {reviewPhase && (
            <button
              onClick={() => setActivePhase(reviewPhase.phase_type)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 hover:bg-emerald-400 transition-colors"
            >
              <span className="text-xs text-white font-medium">
                Review needed
              </span>
            </button>
          )}
          <button
            onClick={() => setTheme(themeMode === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <ProfileDropdown compact />
        </div>
      </header>

      {/* 3-pane workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left rail */}
        <JourneyRail
          phases={phases}
          activePhase={activePhase}
          onSelectPhase={setActivePhase}
          project={project}
        />

        {/* Center — phase content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <PhasePage
            projectId={projectId}
            phaseType={activePhase}
            phases={phases}
            agentProgress={progress}
            onPhaseStarted={handlePhaseStarted}
            onNavigateToPhase={setActivePhase}
          />
        </div>

        {/* Right panel — Chat */}
        <div className="w-80 xl:w-96 shrink-0 border-l border-border overflow-hidden">
          <ChatPanel
            projectId={projectId}
            onPhaseStarted={handlePhaseStarted}
          />
        </div>
      </div>
    </div>
  );
}
