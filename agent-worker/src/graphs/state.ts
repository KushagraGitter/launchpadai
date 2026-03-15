import { Annotation } from "@langchain/langgraph"
import type { ProjectData, NodeResult } from "../types"

export const PhaseStateAnnotation = Annotation.Root({
  projectId: Annotation<string>,
  phaseId: Annotation<string>,
  phaseType: Annotation<string>,
  projectData: Annotation<ProjectData>,
  ragContext: Annotation<string>,
  chatContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  userFeedback: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  nodeResults: Annotation<Record<string, NodeResult>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
})

export type PhaseStateType = typeof PhaseStateAnnotation.State
