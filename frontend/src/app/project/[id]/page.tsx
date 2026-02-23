"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Rocket,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
} from "lucide-react";
import { api, Project } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ChatPanel from "@/components/chat/ChatPanel";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
import AgentActivityFeed from "@/components/canvas/AgentActivityFeed";
import { useAgentProgress } from "@/lib/useAgentProgress";
import ProfileDropdown from "@/components/ui/ProfileDropdown";

const MIN_CHAT_W = 340;
const MAX_CHAT_W = 720;
const DEFAULT_CHAT_W = 440;

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { getToken, user, loadUser, isLoading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [canvasRefresh, setCanvasRefresh] = useState(0);

  // Panel layout state
  const [chatVisible, setChatVisible] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_W);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live agent progress
  const { progress } = useAgentProgress(projectId);

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

  const handlePhaseStarted = useCallback((phase: string) => {
    setCanvasRefresh((n) => n + 1);
  }, []);

  // Auto-refresh canvas when a phase completes via WebSocket
  useEffect(() => {
    if (!progress.isRunning && progress.completedAgents.length > 0) {
      setCanvasRefresh((n) => n + 1);
    }
  }, [progress.isRunning, progress.completedAgents.length]);

  // Drag-to-resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return;
      const containerLeft = containerRef.current.getBoundingClientRect().left;
      const newWidth = e.clientX - containerLeft;
      setChatWidth(Math.max(MIN_CHAT_W, Math.min(MAX_CHAT_W, newWidth)));
    }

    function onMouseUp() {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600">
            <Rocket className="h-3 w-3 text-white -rotate-45" />
          </div>
          <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">
            {project.name}
          </h1>
          {project.domain && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
              {project.domain}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle chat panel */}
          <button
            onClick={() => setChatVisible((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={chatVisible ? "Hide chat panel" : "Show chat panel"}
          >
            {chatVisible ? (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="hidden sm:inline">Hide Chat</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Show Chat</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          <ProfileDropdown compact />
        </div>
      </header>

      {/* Main content with resizable split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* Chat panel */}
        {chatVisible && (
          <>
            <div
              className="shrink-0 overflow-hidden transition-[width] border-r border-border"
              style={{
                width: chatWidth,
                transition: isDragging ? "none" : "width 0.2s ease",
              }}
            >
              <ChatPanel
                projectId={projectId}
                onPhaseStarted={handlePhaseStarted}
              />
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              className={`group relative z-20 w-0 shrink-0 cursor-col-resize ${
                isDragging ? "" : ""
              }`}
            >
              {/* Invisible wider hit target */}
              <div className="absolute inset-y-0 -left-[5px] w-[10px]" />
              {/* Visible line */}
              <div
                className={`absolute inset-y-0 -left-px w-[3px] transition-colors duration-150 ${
                  isDragging
                    ? "bg-brand-500"
                    : "bg-transparent group-hover:bg-brand-500/60"
                }`}
              />
            </div>
          </>
        )}

        {/* Canvas */}
        <div className="flex-1 min-w-0 relative">
          <WorkflowCanvas
            projectId={projectId}
            refreshTrigger={canvasRefresh}
          />

          {/* Live agent activity feed */}
          <AgentActivityFeed progress={progress} />

          {/* Floating chat toggle when chat is hidden */}
          {!chatVisible && (
            <button
              onClick={() => setChatVisible(true)}
              className="absolute bottom-5 left-5 z-10 flex items-center gap-2 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm font-medium text-foreground shadow-lg hover:bg-accent transition-all hover:shadow-xl"
            >
              <MessageSquare className="h-4 w-4" />
              Open Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
