"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "./auth";

export interface AgentEvent {
  type: string;
  phase_id?: string;
  project_id?: string;
  phase_type?: string;
  agent?: string;
  agents?: string[];
  task?: string;
  thought?: string;
  summary?: string;
  error?: string;
  timestamp?: string;
}

export interface AgentProgress {
  phaseType: string | null;
  agents: string[];
  activeAgent: string | null;
  activeTask: string | null;
  completedAgents: string[];
  events: AgentEvent[];
  isRunning: boolean;
  error: string | null;
}

const INITIAL_STATE: AgentProgress = {
  phaseType: null,
  agents: [],
  activeAgent: null,
  activeTask: null,
  completedAgents: [],
  events: [],
  isRunning: false,
  error: null,
};

const WS_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
  : (typeof window !== "undefined" ? `ws://${window.location.host}` : "");

export function useAgentProgress(projectId: string) {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<AgentProgress>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !projectId) return;

    if (wsRef.current && wsRef.current.readyState < 2) return;

    const url = `${WS_BASE}/api/ws/projects/${projectId}/agents`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ token }));
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const event: AgentEvent = JSON.parse(e.data);
        handleEvent(event);
      } catch {
        // malformed
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [projectId, getToken]);

  function handleEvent(event: AgentEvent) {
    setProgress((prev) => {
      switch (event.type) {
        case "connected":
          return prev;

        case "phase_start":
          return {
            ...INITIAL_STATE,
            phaseType: event.phase_type || null,
            agents: event.agents || [],
            isRunning: true,
            events: [...prev.events, event].slice(-50),
          };

        case "agent_start":
          return {
            ...prev,
            activeAgent: event.agent || null,
            activeTask: event.task || null,
            isRunning: true,
            events: [...prev.events, event].slice(-50),
          };

        case "agent_thinking":
          return {
            ...prev,
            events: [...prev.events, event].slice(-50),
          };

        case "agent_complete":
          return {
            ...prev,
            completedAgents: event.agent
              ? [...prev.completedAgents, event.agent]
              : prev.completedAgents,
            activeAgent: null,
            activeTask: null,
            events: [...prev.events, event].slice(-50),
          };

        case "phase_complete":
          return {
            ...prev,
            isRunning: false,
            activeAgent: null,
            activeTask: null,
            events: [...prev.events, event].slice(-50),
          };

        case "phase_error":
          return {
            ...prev,
            isRunning: false,
            activeAgent: null,
            error: event.error || "Phase execution failed",
            events: [...prev.events, event].slice(-50),
          };

        case "snapshot":
          return prev;

        default:
          return prev;
      }
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const reset = useCallback(() => {
    setProgress(INITIAL_STATE);
  }, []);

  return { progress, reset };
}
