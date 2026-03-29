const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface FetchOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

let _refreshPromise: Promise<void> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = typeof window !== "undefined" ? sessionStorage.getItem("refresh_token") : null;
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    sessionStorage.setItem("access_token", data.access_token);
    sessionStorage.setItem("refresh_token", data.refresh_token);

    const { useAuth } = await import("./auth");
    useAuth.setState({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });

    return true;
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<boolean> {
  if (_refreshPromise) {
    await _refreshPromise;
    return !!sessionStorage.getItem("access_token");
  }

  let resolve: () => void;
  _refreshPromise = new Promise<void>((r) => { resolve = r; });

  const ok = await tryRefreshToken();
  _refreshPromise = null;
  resolve!();
  return ok;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, _retried, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(extraHeaders || {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    ),
  };

  const currentToken = token || (typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null);
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, { ...rest, headers });

  if (response.status === 401 && !_retried && currentToken) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch<T>(endpoint, { ...options, _retried: true });
    }

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
      const { useAuth } = await import("./auth");
      useAuth.setState({ accessToken: null, refreshToken: null, user: null });
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; name: string }) =>
      apiFetch<{ access_token: string; refresh_token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      apiFetch<{ access_token: string; refresh_token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    refresh: (refreshToken: string) =>
      apiFetch<{ access_token: string; refresh_token: string }>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
    me: (token: string) =>
      apiFetch<UserInfo>("/api/auth/me", { token }),
    verifyEmail: (token: string) =>
      apiFetch<{ message: string }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    resendVerification: (email: string) =>
      apiFetch<{ message: string }>("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    forgotPassword: (email: string) =>
      apiFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      apiFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
  },

  projects: {
    list: (token: string, skip = 0, limit = 20) =>
      apiFetch<{ projects: Project[]; total: number }>(
        `/api/projects?skip=${skip}&limit=${limit}`,
        { token }
      ),
    get: (token: string, id: string) =>
      apiFetch<Project>(`/api/projects/${id}`, { token }),
    create: (token: string, data: { name: string; raw_idea: string; domain?: string; target_audience?: string }) =>
      apiFetch<Project>("/api/projects", { method: "POST", body: JSON.stringify(data), token }),
    update: (token: string, id: string, data: Partial<{ name: string; raw_idea: string }>) =>
      apiFetch<Project>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(data), token }),
    delete: (token: string, id: string) =>
      apiFetch<void>(`/api/projects/${id}`, { method: "DELETE", token }),
  },

  phases: {
    list: (token: string, projectId: string) =>
      apiFetch<Phase[]>(`/api/projects/${projectId}/phases`, { token }),
    run: (token: string, projectId: string, phaseType: string) =>
      apiFetch<Phase>(`/api/projects/${projectId}/phases/run`, {
        method: "POST",
        body: JSON.stringify({ phase_type: phaseType }),
        token,
      }),
    cancel: (token: string, projectId: string, phaseType: string) =>
      apiFetch<Phase>(`/api/projects/${projectId}/phases/${phaseType}/cancel`, {
        method: "POST",
        token,
      }),
    rerunAgents: (token: string, projectId: string, phaseType: string, agentNames: string[]) =>
      apiFetch<Phase>(`/api/projects/${projectId}/phases/${phaseType}/rerun-agents`, {
        method: "POST",
        body: JSON.stringify({ agent_names: agentNames }),
        token,
      }),
    detail: (token: string, projectId: string, phaseType: string) =>
      apiFetch<PhaseDetail>(`/api/projects/${projectId}/phases/${phaseType}`, { token }),
    artifacts: (token: string, projectId: string, phaseType: string) =>
      apiFetch<Artifact[]>(`/api/projects/${projectId}/phases/${phaseType}/artifacts`, { token }),
    updateArtifact: (token: string, projectId: string, artifactId: string, data: { markdown_content?: string; title?: string }) =>
      apiFetch<Artifact>(`/api/projects/${projectId}/artifacts/${artifactId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        token,
      }),
    exportZip: async (token: string, projectId: string, phaseType: string) => {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/export/${phaseType}?format=zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new ApiError(response.status, response.statusText, null);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${phaseType}_artifacts.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    submitFeedback: (token: string, projectId: string, phaseType: string, feedback: FeedbackCreate) =>
      apiFetch<PhaseFeedback>(`/api/projects/${projectId}/phases/${phaseType}/feedback`, {
        method: "POST",
        body: JSON.stringify(feedback),
        token,
      }),
    listFeedback: (token: string, projectId: string, phaseType: string) =>
      apiFetch<PhaseFeedback[]>(`/api/projects/${projectId}/phases/${phaseType}/feedback`, { token }),
    acceptPhase: (token: string, projectId: string, phaseType: string) =>
      apiFetch<Phase>(`/api/projects/${projectId}/phases/${phaseType}/accept`, {
        method: "POST",
        token,
      }),
    refine: (token: string, projectId: string, phaseType: string, agentNames: string[]) =>
      apiFetch<Phase>(`/api/projects/${projectId}/phases/${phaseType}/refine`, {
        method: "POST",
        body: JSON.stringify({ agent_names: agentNames }),
        token,
      }),
  },

  keys: {
    list: (token: string) =>
      apiFetch<APIKeyListResponse>("/api/keys", { token }),
    create: (token: string, name: string) =>
      apiFetch<APIKeyCreateResponse>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name }),
        token,
      }),
    revoke: (token: string, keyId: string) =>
      apiFetch<void>(`/api/keys/${keyId}`, { method: "DELETE", token }),
    rename: (token: string, keyId: string, name: string) =>
      apiFetch<APIKeyItem>(`/api/keys/${keyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
        token,
      }),
  },

  subscriptions: {
    current: (token: string) =>
      apiFetch<SubscriptionInfo>("/api/subscriptions/current", { token }),
    checkout: (token: string, plan: string) =>
      apiFetch<CheckoutInfo>("/api/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
        token,
      }),
    verify: (token: string, data: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) =>
      apiFetch<{ status: string; plan: string }>("/api/subscriptions/verify", {
        method: "POST",
        body: JSON.stringify(data),
        token,
      }),
    cancel: (token: string) =>
      apiFetch<{ status: string; message: string }>("/api/subscriptions/cancel", {
        method: "POST",
        token,
      }),
    history: (token: string) =>
      apiFetch<PaymentRecord[]>("/api/subscriptions/history", { token }),
  },
};

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  plan: "free" | "pro" | "developer" | "team";
  project_limit: number;
  project_count: number;
  created_at: string;
}

export interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  rate_limit_rpm: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface APIKeyListResponse {
  keys: APIKeyItem[];
  total: number;
  plan_limit: number;
}

export interface APIKeyCreateResponse {
  id: string;
  name: string;
  key: string; // Raw key — shown ONCE
  key_prefix: string;
  rate_limit_rpm: number;
  created_at: string;
}

export interface SubscriptionInfo {
  id: string;
  plan: string;
  status: string;
  project_limit: number;
  project_count: number;
  razorpay_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  razorpay_payment_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface CheckoutInfo {
  subscription_id: string;
  razorpay_key_id: string;
  razorpay_subscription_id: string;
}

export interface Project {
  id: string;
  name: string;
  raw_idea: string;
  domain: string | null;
  target_audience: string | null;
  status: string;
  current_phase: string | null;
  use_v2_worker: boolean;
  constraints: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  phase_id: string;
  agent_name: string;
  artifact_type: string;
  title: string;
  content: Record<string, unknown> | null;
  markdown_content: string | null;
  created_at: string;
}

export interface AgentRun {
  id: string;
  phase_id: string;
  crew_name: string;
  agent_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  token_usage: Record<string, unknown> | null;
  output_summary: string | null;
  created_at: string;
}

export interface PhaseDetail {
  phase: Phase;
  artifacts: Artifact[];
  agent_runs: AgentRun[];
}

export type FeedbackType = "thumbs_up" | "thumbs_down" | "comment";

export interface FeedbackCreate {
  artifact_id?: string | null;
  section: string;
  feedback_type: FeedbackType;
  comment?: string | null;
}

export interface PhaseFeedback {
  id: string;
  phase_id: string;
  artifact_id: string | null;
  section: string;
  feedback_type: FeedbackType;
  comment: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata_: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  project_name: string;
  project_idea: string;
}

// ── GitHub Integration ─────────────────────────────────────────────────────
export interface GitHubStatus {
  connected: boolean;
  github_username: string | null;
  default_repo: string | null;
  connected_at: string | null;
}

export interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  html_url: string;
}

export interface GitHubIssueResult {
  number: number;
  html_url: string;
  title: string;
}

export interface GitHubExportResult {
  repo: string;
  issues_created: number;
  issues: GitHubIssueResult[];
  errors: string[];
}

export const githubApi = {
  status: (token: string) =>
    apiFetch<GitHubStatus>("/api/integrations/github/status", { token }),

  connect: (token: string, ghToken: string) =>
    apiFetch<GitHubStatus>("/api/integrations/github/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ghToken }),
      token,
    }),

  disconnect: (token: string) =>
    apiFetch<{ status: string }>("/api/integrations/github/disconnect", {
      method: "DELETE",
      token,
    }),

  repos: (token: string) =>
    apiFetch<GitHubRepo[]>("/api/integrations/github/repos", { token }),

  setDefaultRepo: (token: string, repo: string) =>
    apiFetch<GitHubStatus>("/api/integrations/github/default-repo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
      token,
    }),

  exportToGitHub: (token: string, projectId: string, repo: string) =>
    apiFetch<GitHubExportResult>(`/api/${projectId}/export/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
      token,
    }),
};

// ── Landing Page ──────────────────────────────────────────────────────────
export interface LandingPageInfo {
  id: string;
  project_id: string;
  slug: string;
  page_title: string;
  meta_description: string;
  is_published: boolean;
  view_count: number;
  template_style: string;
  created_at: string;
  updated_at: string;
  lead_count: number;
  conversion_rate: number;
  public_url: string;
}

export interface LandingPageLead {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  created_at: string;
}

export const landingPageApi = {
  getInfo: (token: string, projectId: string) =>
    apiFetch<LandingPageInfo>(`/api/projects/${projectId}/landing-page`, { token }),

  getLeads: (token: string, projectId: string) =>
    apiFetch<LandingPageLead[]>(`/api/projects/${projectId}/landing-page/leads`, { token }),

  togglePublish: (token: string, projectId: string, publish: boolean) =>
    apiFetch<{ is_published: boolean; slug: string }>(`/api/projects/${projectId}/landing-page/publish`, {
      method: "PUT",
      body: JSON.stringify({ publish }),
      token,
    }),
};

export const chatApi = {
  history: (token: string, projectId: string) =>
    apiFetch<ChatHistory>(`/api/projects/${projectId}/chat/history`, { token }),

  sendMessage: async function* (
    token: string,
    projectId: string,
    message: string
  ): AsyncGenerator<{
    type: string;
    content?: string;
    action?: string;
    phase?: string;
    feedback_count?: number;
  }> {
    let currentToken = sessionStorage.getItem("access_token") || token;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ message }),
      });
    } catch (networkErr) {
      throw new ApiError(0, "Network error — unable to reach the server", null);
    }

    if (response.status === 401) {
      const refreshed = await refreshOnce();
      if (refreshed) {
        currentToken = sessionStorage.getItem("access_token") || currentToken;
        response = await fetch(`${API_BASE}/api/projects/${projectId}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ message }),
        });
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, null);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              yield JSON.parse(line.slice(6));
            } catch {
              // skip malformed chunks
            }
          }
          // SSE comments (keep-alive) are silently ignored
        }
      }
    } catch (streamErr) {
      yield { type: "error", content: "Connection was interrupted. Please try again." };
      yield { type: "done" };
    }
  },
};

export { ApiError };
