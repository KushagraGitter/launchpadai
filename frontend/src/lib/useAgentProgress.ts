"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";

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
  thinkingStreams: Record<string, string>;
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
  thinkingStreams: {},
  events: [],
  isRunning: false,
  error: null,
};

// Render at most once per THROTTLE_MS — coalesces rapid agent_thinking bursts
// into smooth visible streaming without flooding React with 786 individual setStates.
const THROTTLE_MS = 120;

const WS_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
  : (typeof window !== "undefined" ? `ws://${window.location.host}` : "");

export function useAgentProgress(projectId: string) {
  const { getToken } = useClerkAuth();
  const [progress, setProgress] = useState<AgentProgress>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const backoffRef = useRef(2000);

  const pendingThinkingRef = useRef<Record<string, string>>({});
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush accumulated thinking text into React state
  const flushThinking = useCallback(() => {
    throttleTimerRef.current = null;
    const pending = pendingThinkingRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingThinkingRef.current = {};
    setProgress((prev) => ({
      ...prev,
      thinkingStreams: {
        ...prev.thinkingStreams,
        ...Object.fromEntries(
          Object.entries(pending).map(([agent, text]) => [
            agent,
            (prev.thinkingStreams[agent] || "") + text,
          ])
        ),
      },
    }));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = setTimeout(flushThinking, THROTTLE_MS);
  }, [flushThinking]);

  const connect = useCallback(async () => {
    const token = await getToken();
    if (!token || !projectId) return;

    if (wsRef.current && wsRef.current.readyState < 2) return;

    const url = `${WS_BASE}/api/ws/projects/${projectId}/agents`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ token }));
      backoffRef.current = 2000;
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const event: AgentEvent = JSON.parse(e.data);
        if (event.type === "ping") return;
        handleEvent(event);
      } catch {
        // malformed frame
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 1.5, 30000);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [projectId, getToken]);

  function handleEvent(event: AgentEvent) {
    // agent_thinking: accumulate into ref and schedule a throttled flush
    if (event.type === "agent_thinking") {
      if (!event.agent || !event.thought) return;
      pendingThinkingRef.current[event.agent] =
        (pendingThinkingRef.current[event.agent] || "") + event.thought;
      scheduleFlush();
      return;
    }

    // All other events: flush any pending thinking first, then apply immediately
    if (Object.keys(pendingThinkingRef.current).length > 0) {
      flushThinking();
    }

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

        case "phase_in_review":
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
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const reset = useCallback(() => {
    pendingThinkingRef.current = {};
    setProgress(INITIAL_STATE);
  }, []);

  return { progress, reset };
}
