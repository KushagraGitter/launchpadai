/**
 * HTTP client for LaunchPadAI Developer API v1.
 * Reads LAUNCHPADAI_API_KEY and LAUNCHPADAI_API_URL from env.
 */

const DEFAULT_API_URL = "https://api.launchpadai.com"

export class LaunchPadAPIClient {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.LAUNCHPADAI_API_KEY || ""
    this.baseUrl = (process.env.LAUNCHPADAI_API_URL || DEFAULT_API_URL).replace(/\/$/, "")

    if (!this.apiKey) {
      throw new Error(
        "LAUNCHPADAI_API_KEY environment variable is required. " +
        "Get your API key at https://app.launchpadai.com/settings/api-keys"
      )
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "launchpadai-mcp/0.1.0",
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      let detail = errorBody
      try {
        const parsed = JSON.parse(errorBody)
        detail = parsed.detail || errorBody
      } catch {}
      throw new Error(`LaunchPadAI API error (${response.status}): ${detail}`)
    }

    return response.json() as Promise<T>
  }

  async validateIdea(params: {
    idea: string
    name?: string
    domain?: string
    target_audience?: string
  }) {
    return this.request<{
      project_id: string
      phase_id: string
      status: string
      message: string
    }>("POST", "/validate", params)
  }

  async listProjects(limit = 20) {
    return this.request<{
      projects: Array<{
        id: string
        name: string
        status: string
        current_phase: string | null
        created_at: string
      }>
      total: number
    }>("GET", `/projects?limit=${limit}`)
  }

  async getProjectPhases(projectId: string) {
    return this.request<Array<{
      phase_id: string
      phase_type: string
      status: string
      started_at: string | null
      completed_at: string | null
    }>>("GET", `/projects/${projectId}/phases`)
  }

  async getBenchmarkScore(projectId: string) {
    return this.request<{
      project_id: string
      overall_score: number
      percentile_estimate: number
      verdict: string
      one_line_summary: string
      biggest_strength: string
      biggest_risk: string
      dimensions: Record<string, { score: number; rationale: string }>
    }>("GET", `/projects/${projectId}/score`)
  }

  async getProjectArtifacts(projectId: string, phase?: string) {
    const query = phase ? `?phase=${phase}` : ""
    return this.request<{
      artifacts: Array<{
        id: string
        agent_name: string
        artifact_type: string
        title: string
        content: unknown
        markdown_content: string | null
        created_at: string
      }>
      project_id: string
      phase: string | null
    }>("GET", `/projects/${projectId}/artifacts${query}`)
  }

  async runPhase(projectId: string, phaseType: string) {
    return this.request<{
      project_id: string
      phase_id: string
      status: string
      message: string
    }>("POST", `/projects/${projectId}/run-phase?phase_type=${phaseType}`)
  }
}
