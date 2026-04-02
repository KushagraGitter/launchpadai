"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { api, SubscriptionInfo, PaymentRecord, APIKeyItem, APIKeyCreateResponse, githubApi, GitHubStatus, GitHubRepo } from "@/lib/api";
import {
  Crown,
  Zap,
  Check,
  Loader2,
  CreditCard,
  AlertTriangle,
  Users,
  FolderOpen,
  Rocket,
  Key,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Code2,
  Terminal,
  Github,
  ExternalLink,
  Unlink,
  Link2,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For trying out LaunchPadAI",
    features: ["1 project", "All 4 AI phases", "Community support"],
    icon: FolderOpen,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    description: "For serious builders",
    features: ["Up to 5 projects", "All 4 AI phases", "Email support", "Export artifacts"],
    icon: Zap,
    popular: true,
  },
  {
    id: "developer",
    name: "Developer",
    price: 29,
    description: "For API & MCP access",
    features: [
      "Unlimited projects",
      "All 4 AI phases",
      "REST API access",
      "MCP server integration",
      "5 API keys, 500 RPM",
      "Export artifacts",
    ],
    icon: Code2,
  },
  {
    id: "team",
    name: "Team",
    price: 49,
    description: "For startups & teams",
    features: [
      "Unlimited projects",
      "All 4 AI phases",
      "Multi-user collaboration",
      "20 API keys, 1000 RPM",
      "Priority support",
      "Export artifacts",
    ],
    icon: Users,
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // API Key state
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([]);
  const [apiKeyLimit, setApiKeyLimit] = useState(0);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<APIKeyCreateResponse | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  // GitHub state
  const [ghStatus, setGhStatus] = useState<GitHubStatus | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubRepo[]>([]);
  const [ghToken, setGhToken] = useState("");
  const [ghConnecting, setGhConnecting] = useState(false);
  const [ghDisconnecting, setGhDisconnecting] = useState(false);
  const [ghLoadingRepos, setGhLoadingRepos] = useState(false);
  const [ghShowToken, setGhShowToken] = useState(false);
  const [ghSelectedRepo, setGhSelectedRepo] = useState("");

  const loadGitHubStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const status = await githubApi.status(token);
      setGhStatus(status);
      if (status.connected) {
        setGhLoadingRepos(true);
        try {
          const repos = await githubApi.repos(token);
          setGhRepos(repos);
          if (status.default_repo) setGhSelectedRepo(status.default_repo);
        } catch {
          // ignore
        } finally {
          setGhLoadingRepos(false);
        }
      }
    } catch {
      setGhStatus({ connected: false, github_username: null, default_repo: null, connected_at: null });
    }
  }, [getToken]);

  async function handleGitHubConnect() {
    const token = await getToken();
    if (!token || !ghToken.trim()) return;
    setGhConnecting(true);
    try {
      const status = await githubApi.connect(token, ghToken.trim());
      setGhStatus(status);
      setGhToken("");
      setMessage({ type: "success", text: `GitHub connected as @${status.github_username}` });
      // Load repos after connecting
      try {
        const repos = await githubApi.repos(token);
        setGhRepos(repos);
      } catch { /* ignore */ }
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail || "Failed to connect GitHub";
      setMessage({ type: "error", text: detail });
    } finally {
      setGhConnecting(false);
    }
  }

  async function handleGitHubDisconnect() {
    const token = await getToken();
    if (!token) return;
    if (!window.confirm("Disconnect GitHub? This will remove your token and disable issue export.")) return;
    setGhDisconnecting(true);
    try {
      await githubApi.disconnect(token);
      setGhStatus({ connected: false, github_username: null, default_repo: null, connected_at: null });
      setGhRepos([]);
      setGhSelectedRepo("");
      setMessage({ type: "success", text: "GitHub disconnected." });
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect GitHub." });
    } finally {
      setGhDisconnecting(false);
    }
  }

  async function handleSetDefaultRepo(repo: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await githubApi.setDefaultRepo(token, repo);
      setGhSelectedRepo(repo);
      setMessage({ type: "success", text: `Default repo set to ${repo}` });
    } catch {
      setMessage({ type: "error", text: "Failed to set default repo." });
    }
  }

  const loadApiKeys = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.keys.list(token);
      setApiKeys(data.keys);
      setApiKeyLimit(data.plan_limit);
    } catch {
      // Plan doesn't support API keys — that's fine
      setApiKeys([]);
      setApiKeyLimit(0);
    }
  }, [getToken]);

  async function handleCreateKey() {
    const token = await getToken();
    if (!token || !newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const created = await api.keys.create(token, newKeyName.trim());
      setNewlyCreatedKey(created);
      setShowNewKey(true);
      setNewKeyName("");
      loadApiKeys();
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail || "Failed to create API key";
      setMessage({ type: "error", text: detail });
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(keyId: string) {
    const token = await getToken();
    if (!token) return;
    if (!window.confirm("Revoke this API key? This cannot be undone.")) return;
    setRevokingKeyId(keyId);
    try {
      await api.keys.revoke(token, keyId);
      loadApiKeys();
      setMessage({ type: "success", text: "API key revoked." });
    } catch {
      setMessage({ type: "error", text: "Failed to revoke key." });
    } finally {
      setRevokingKeyId(null);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  const loadData = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const [sub, hist] = await Promise.all([
        api.subscriptions.current(token),
        api.subscriptions.history(token),
      ]);
      setSubscription(sub);
      setPayments(hist);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
    loadApiKeys();
    loadGitHubStatus();
    loadRazorpayScript();
  }, [loadData, loadApiKeys, loadGitHubStatus]);

  function loadRazorpayScript() {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }

  async function handleUpgrade(planId: string) {
    const token = await getToken();
    if (!token) return;
    setCheckoutLoading(planId);
    setMessage(null);

    try {
      const checkout = await api.subscriptions.checkout(token, planId);

      const options = {
        key: checkout.razorpay_key_id,
        subscription_id: checkout.razorpay_subscription_id,
        name: "LaunchPadAI",
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - Monthly`,
        handler: async (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            await api.subscriptions.verify(token, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            setMessage({ type: "success", text: "Subscription activated successfully!" });
            loadData();
            // user info refreshed via Clerk sync
          } catch {
            setMessage({ type: "error", text: "Payment verification failed. Please contact support." });
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: { color: "#6366f1" },
        modal: {
          ondismiss: () => setCheckoutLoading(null),
        },
      };

      if (typeof window.Razorpay !== "undefined") {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        setMessage({ type: "error", text: "Payment system not loaded. Please refresh the page." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Could not initiate checkout. Payment system may not be configured." });
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    const token = await getToken();
    if (!token) return;
    if (!window.confirm("Are you sure you want to cancel your subscription? You will be downgraded at the end of your billing period.")) return;

    setCancelLoading(true);
    try {
      await api.subscriptions.cancel(token);
      setMessage({ type: "success", text: "Subscription cancelled. It will remain active until the end of the billing period." });
      loadData();
      // user info refreshed via Clerk sync
    } catch {
      setMessage({ type: "error", text: "Failed to cancel subscription." });
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "free";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings & Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and billing</p>
      </div>

      {message && (
        <div className={`rounded-xl border p-4 text-sm ${
          message.type === "success"
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Current Plan */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Current Plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription?.project_count ?? 0} of {subscription?.project_limit === -1 ? "unlimited" : subscription?.project_limit ?? 1} projects used
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wider ${
              currentPlan === "team" ? "bg-purple-600/20 text-purple-300 border border-purple-500/30" :
              currentPlan === "pro" ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30" :
              "bg-muted text-muted-foreground"
            }`}>
              {currentPlan}
            </span>
          </div>
        </div>

        {/* Usage bar */}
        {subscription && subscription.project_limit !== -1 && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-purple-500 transition-all duration-700"
                style={{ width: `${Math.min(100, ((subscription.project_count || 0) / Math.max(subscription.project_limit, 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {subscription?.status === "cancelled" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Subscription cancelled. Active until end of billing period.
          </div>
        )}

        {currentPlan !== "free" && subscription?.status !== "cancelled" && (
          <div className="mt-4">
            <button
              onClick={handleCancel}
              disabled={cancelLoading}
              className="text-sm text-muted-foreground hover:text-red-400 transition-colors"
            >
              {cancelLoading ? "Cancelling..." : "Cancel subscription"}
            </button>
          </div>
        )}
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const PlanIcon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-6 transition-all ${
                  plan.popular
                    ? "border-emerald-500/50 bg-card"
                    : "border-border bg-card hover:border-border"
                }`}
              >
                {plan.popular && (
                  <span className="mb-3 inline-flex rounded-full bg-emerald-600/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    plan.popular ? "bg-emerald-600/20 text-emerald-400" : "bg-muted text-muted-foreground"
                  }`}>
                    <PlanIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                  {plan.price > 0 && <span className="text-sm text-muted-foreground">/month</span>}
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-green-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {isCurrent ? (
                    <button disabled className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-default">
                      Current Plan
                    </button>
                  ) : plan.id === "free" ? (
                    <div />
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkoutLoading === plan.id}
                      className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        plan.popular
                          ? "bg-gradient-to-r from-emerald-600 to-purple-600 text-white hover:from-emerald-500 hover:to-purple-500"
                          : "bg-secondary text-foreground hover:bg-accent"
                      } disabled:opacity-50`}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Crown className="inline h-4 w-4 mr-1" />
                      )}
                      {isCurrent ? "Current" : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            <CreditCard className="inline h-5 w-5 mr-2 text-muted-foreground" />
            Payment History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 text-foreground font-medium">
                      ${(p.amount_cents / 100).toFixed(2)} {p.currency}
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === "captured" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground font-mono text-xs">{p.razorpay_payment_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              <Key className="inline h-5 w-5 mr-2 text-muted-foreground" />
              API Keys
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Use API keys to access LaunchPadAI programmatically via REST API or MCP server
            </p>
          </div>
          {apiKeyLimit > 0 && (
            <span className="text-xs text-muted-foreground">
              {apiKeys.filter(k => k.is_active).length} / {apiKeyLimit} keys
            </span>
          )}
        </div>

        {apiKeyLimit === 0 ? (
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-6 text-center">
            <Terminal className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              API access requires a <strong className="text-foreground">Developer</strong> or <strong className="text-foreground">Team</strong> plan
            </p>
            <p className="text-xs text-muted-foreground">
              Get REST API + MCP server integration for AI editors like Claude Desktop, Cursor, and VS Code
            </p>
          </div>
        ) : (
          <>
            {/* Newly created key banner */}
            {newlyCreatedKey && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">API key created — copy it now!</span>
                </div>
                <p className="text-xs text-emerald-400/70 mb-3">This key will only be shown once. Store it somewhere safe.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm font-mono text-emerald-300 overflow-x-auto">
                    {showNewKey ? newlyCreatedKey.key : "••••••••••••••••••••••••••••••••"}
                  </code>
                  <button
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title={showNewKey ? "Hide key" : "Show key"}
                  >
                    {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey.key, "new")}
                    className="rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Copy key"
                  >
                    {copiedKeyId === "new" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="mt-3 text-xs text-emerald-400/60 hover:text-emerald-400 transition-colors"
                >
                  I&apos;ve saved it — dismiss
                </button>
              </div>
            )}

            {/* Create new key */}
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Key name (e.g. 'Cursor MCP', 'CI Pipeline')"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                className="flex-1 rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
              <button
                onClick={handleCreateKey}
                disabled={creatingKey || !newKeyName.trim() || apiKeys.filter(k => k.is_active).length >= apiKeyLimit}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-emerald-500 hover:to-purple-500 transition-colors disabled:opacity-50"
              >
                {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>

            {/* Key list */}
            {apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                      k.is_active
                        ? "border-border bg-secondary/30"
                        : "border-border/30 bg-secondary/10 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Key className={`h-4 w-4 shrink-0 ${k.is_active ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <code className="text-xs text-muted-foreground font-mono">{k.key_prefix}</code>
                          <span className="text-xs text-muted-foreground">
                            {k.rate_limit_rpm} RPM
                          </span>
                          {k.last_used_at && (
                            <span className="text-xs text-muted-foreground">
                              Last used {new Date(k.last_used_at).toLocaleDateString()}
                            </span>
                          )}
                          {!k.is_active && (
                            <span className="text-xs text-red-400 font-medium">Revoked</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {k.is_active && (
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        disabled={revokingKeyId === k.id}
                        className="rounded-lg p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Revoke key"
                      >
                        {revokingKeyId === k.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No API keys yet. Create one to get started.
              </p>
            )}

            {/* MCP Server setup hint */}
            <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">MCP Server</span>
              </div>
              <p className="text-xs text-purple-300/70 mb-2">
                Use your API key with the LaunchPadAI MCP server in Claude Desktop, Cursor, or any MCP client:
              </p>
              <code className="block rounded-lg bg-black/30 px-3 py-2 text-xs font-mono text-purple-300 overflow-x-auto whitespace-pre">
{`{
  "mcpServers": {
    "launchpadai": {
      "command": "npx",
      "args": ["launchpadai-mcp"],
      "env": { "LAUNCHPADAI_API_KEY": "your_key_here" }
    }
  }
}`}
              </code>
            </div>
          </>
        )}
      </div>

      {/* GitHub Integration */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              <Github className="inline h-5 w-5 mr-2 text-muted-foreground" />
              GitHub Integration
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect GitHub to export AI-generated tasks as issues with labels &amp; milestones
            </p>
          </div>
          {ghStatus?.connected && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/20">
                @{ghStatus.github_username}
              </span>
            </div>
          )}
        </div>

        {!ghStatus?.connected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-secondary/30 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#24292e] text-white">
                  <Github className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground mb-1">Connect with a Personal Access Token</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Create a{" "}
                    <a
                      href="https://github.com/settings/tokens/new?description=LaunchPadAI&scopes=repo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
                    >
                      fine-grained token
                      <ExternalLink className="inline h-3 w-3 ml-0.5" />
                    </a>{" "}
                    with <code className="rounded bg-secondary px-1 py-0.5 text-xs">repo</code> scope.
                    Your token is stored securely and only used to create issues.
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={ghShowToken ? "text" : "password"}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={ghToken}
                        onChange={(e) => setGhToken(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleGitHubConnect()}
                        className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 font-mono"
                      />
                      <button
                        onClick={() => setGhShowToken(!ghShowToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {ghShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      onClick={handleGitHubConnect}
                      disabled={ghConnecting || !ghToken.trim()}
                      className="flex items-center gap-2 rounded-xl bg-[#24292e] hover:bg-[#2f363d] px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
                    >
                      {ghConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Connect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected status + default repo selector */}
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-medium text-green-300">Connected to GitHub</span>
                </div>
                <button
                  onClick={handleGitHubDisconnect}
                  disabled={ghDisconnecting}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {ghDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                  Disconnect
                </button>
              </div>

              {/* Default repo selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Default repository for issue export</label>
                {ghLoadingRepos ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading repositories...
                  </div>
                ) : (
                  <select
                    value={ghSelectedRepo}
                    onChange={(e) => handleSetDefaultRepo(e.target.value)}
                    className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 appearance-none cursor-pointer"
                  >
                    <option value="">Select a repository...</option>
                    {ghRepos.map((repo) => (
                      <option key={repo.full_name} value={repo.full_name}>
                        {repo.full_name} {repo.private ? "(private)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">How it works</h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">1.</span>
                  Run the <strong className="text-foreground">Coding Context</strong> phase to generate task decomposition
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">2.</span>
                  Click <strong className="text-foreground">Export to GitHub</strong> on the phase results
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">3.</span>
                  Tasks become issues with labels, milestones &amp; dependency links
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="card">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          <Rocket className="inline h-5 w-5 mr-2 text-muted-foreground -rotate-45" />
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm text-foreground">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm text-foreground">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="text-sm text-foreground">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
