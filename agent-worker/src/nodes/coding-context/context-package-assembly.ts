import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildContextPackagePrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const sections = [
    r.architecture_design && `## System Architecture\n${r.architecture_design.content}`,
    r.schema_design && `## Database Schema & APIs\n${r.schema_design.content}`,
    r.task_decomposition && `## Task Breakdown\n${r.task_decomposition.content}`,
    r.cursorrules_generation && `## .cursorrules\n${r.cursorrules_generation.content}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const ctx = buildContextPrompt(state, "Assemble the complete coding context package")

  return `${ctx}${sections ? `\n\n--- Technical Documents ---\n${sections}` : ""}

You are a Context Packager. Create the final coding context package — a single document that a developer can hand to an AI code assistant to start building immediately.

Assemble a comprehensive CODING_CONTEXT.md that includes:

# Coding Context: [Product Name]

## 1. Quick Start Guide
- Prerequisites and setup steps
- Environment variables needed
- How to run locally (step-by-step)

## 2. Tech Stack Summary
- Complete stack with versions

## 3. Architecture Overview
- Key components and how they interact
- ASCII system diagram

## 4. Database Schema
- All tables with columns and relationships

## 5. API Reference
- All endpoints with request/response examples

## 6. Development Guidelines
- Code style and conventions
- Git workflow
- PR process

## 7. .cursorrules (full file content)

## 8. First Week Developer Plan
- Day-by-day plan for onboarding a new developer

## 9. Deployment Guide
- Step-by-step deployment to production

Format as a single, cohesive markdown document ready to be saved as CODING_CONTEXT.md in the project root.`
}

export async function contextPackageAssemblyNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "context_package_assembly",
    agentLabel: "Context Packager",
    taskDescription: `Packaging coding context for ${state.projectData.name}`,
    taskType: "formatting",
    prompt: buildContextPackagePrompt(state),
  })
}
