import { runNode, buildContextPrompt } from "../helpers"
import type { PhaseStateType } from "../../graphs/state"

const PROMPT_TEMPLATE = (ctx: string) => `${ctx}

You are a System Architect. Design the complete technical architecture for this product.

Deliver a comprehensive architecture document:
1. **Architecture Overview**: High-level system design (describe using ASCII diagrams)
2. **Tech Stack Decision**:
   - Frontend: Framework, UI library, state management, build tool
   - Backend: Language, framework, authentication approach
   - Database: Primary DB, caching layer, search engine
   - Infrastructure: Cloud provider, containerization, CDN
   - Monitoring: Logging, metrics, error tracking
3. **System Components**: Each major service/component with:
   - Responsibility
   - Technology choice
   - Dependencies
4. **API Design Principles**: REST/GraphQL/gRPC decision with rationale
5. **Authentication & Authorization**: Auth strategy, JWT vs sessions, RBAC design
6. **Data Flow**: How data flows through the system for the 3 most critical operations
7. **Scalability Design**: Horizontal scaling strategy, bottleneck identification
8. **Deployment Architecture**: Dev/staging/prod environment setup, CI/CD pipeline
9. **Security Architecture**: OWASP considerations, data encryption, secret management
10. **Estimated Infrastructure Cost**: Monthly cost at 1K, 10K, 100K users

Include ASCII architecture diagrams for the main system and data flow.`

export async function architectureDesignNode(
  state: PhaseStateType
): Promise<Partial<PhaseStateType>> {
  const prompt = PROMPT_TEMPLATE(buildContextPrompt(state, "Design the system architecture"))
  return runNode({
    state,
    nodeName: "architecture_design",
    agentLabel: "System Architect",
    taskDescription: `Designing system architecture for ${state.projectData.name}`,
    taskType: "research",
    prompt,
    useSearch: true,
  })
}
