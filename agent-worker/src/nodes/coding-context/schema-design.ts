import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a Database Schema Designer. Design the complete database schema and API contracts for this product.

Deliver:
1. **Database Schema** (use SQL DDL syntax):
   - All core tables with columns, types, constraints, and indexes
   - Foreign key relationships
   - Enum definitions
   - Include created_at/updated_at timestamps on all tables
2. **Entity Relationship Summary**: Describe the relationships between tables
3. **Core Indexes**: Beyond primary keys, which indexes are critical for performance
4. **API Contracts** (OpenAPI/Swagger style for top 10 endpoints):
   - Method, path, request body schema, response schema
   - Authentication requirements
   - Common error responses
5. **Data Validation Rules**: Key validation rules per entity
6. **Soft Delete Strategy**: How to handle deletions (soft vs hard)
7. **Audit Trail**: Which tables need audit logging
8. **Migration Strategy**: How to handle future schema changes safely

Provide complete, production-ready SQL DDL that a developer can run directly.`

export async function schemaDesignNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Design database schema and API contracts"))
  return runNode({
    state,
    nodeName: "schema_design",
    agentLabel: "Schema Designer",
    taskDescription: `Creating database schema for ${state.projectData.name}`,
    taskType: "research",
    prompt,
  })
}
