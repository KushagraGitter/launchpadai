import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

function buildCursorRulesPrompt(state: PhaseStateType): string {
  const r = state.nodeResults
  const arch = r.architecture_design?.content || ""
  const schema = r.schema_design?.content || ""
  const ctx = buildContextPrompt(state, "Generate .cursorrules file for AI-assisted development")
  const techContext = [arch && `## Architecture\n${arch}`, schema && `## Schema\n${schema}`]
    .filter(Boolean)
    .join("\n\n")

  return `${ctx}${techContext ? `\n\n--- Technical Context ---\n${techContext}` : ""}

You are a Developer Experience Engineer. Generate a comprehensive .cursorrules file for this project.

The .cursorrules file will be used by Cursor IDE (AI code editor) to give the AI context about this specific project.

Generate a .cursorrules file that includes:
1. **Project Overview**: What this product does, tech stack, and key architectural decisions
2. **Code Style Rules**: Naming conventions, file organization, preferred patterns
3. **Framework-Specific Rules**: Rules specific to the chosen frameworks
4. **Database Rules**: ORM patterns, migration practices, query conventions
5. **API Rules**: Endpoint naming, error handling, response formats, authentication patterns
6. **Testing Rules**: Testing frameworks, coverage requirements, test file organization
7. **Security Rules**: What to always/never do regarding security
8. **Performance Rules**: Caching, query optimization, lazy loading guidelines
9. **Component/Module Rules**: How to structure frontend components and backend modules
10. **Common Patterns**: Preferred design patterns for this project
11. **Anti-patterns**: What to avoid in this codebase

Output the COMPLETE .cursorrules file content (not a description of it). The file should be detailed enough that an AI assistant can generate high-quality code without needing additional context.`
}

export async function cursorrulesGenerationNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  return runNode({
    state,
    nodeName: "cursorrules_generation",
    agentLabel: ".cursorrules Generator",
    taskDescription: `Generating .cursorrules for ${state.projectData.name}`,
    taskType: "formatting",
    prompt: buildCursorRulesPrompt(state),
  })
}
