export interface ProjectData {
  id: string
  name: string
  rawIdea: string
  domain: string | null
  targetAudience: string | null
  chatContext?: string
  userFeedback?: string
}

export interface NodeResult {
  nodeName: string
  agentLabel: string
  content: string
  contentJson: Record<string, unknown>
  tokensUsed: number
  completedAt: Date
  error?: string
}

export interface PhaseState {
  projectId: string
  phaseId: string
  phaseType: string
  projectData: ProjectData
  ragContext: string
  nodeResults: Record<string, NodeResult>
  errors: string[]
}

export interface PhaseJob {
  phase_id: string
}

// Redis event payloads — must match Python PhaseCallbackHandler exactly
export interface BaseEvent {
  type: string
  phase_id: string
  project_id: string
  timestamp: string
}

export interface PhaseStartEvent extends BaseEvent {
  type: "phase_start"
  phase_type: string
  agents: string[]
}

export interface AgentStartEvent extends BaseEvent {
  type: "agent_start"
  agent: string
  task: string
}

export interface AgentThinkingEvent extends BaseEvent {
  type: "agent_thinking"
  agent: string
  thought: string
}

export interface AgentCompleteEvent extends BaseEvent {
  type: "agent_complete"
  agent: string
  summary: string
}

export interface PhaseCompleteEvent extends BaseEvent {
  type: "phase_complete"
  phase_type: string
}

export interface PhaseErrorEvent extends BaseEvent {
  type: "phase_error"
  phase_type: string
  error: string
}

export type AgentProgressEvent =
  | PhaseStartEvent
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentCompleteEvent
  | PhaseCompleteEvent
  | PhaseErrorEvent
