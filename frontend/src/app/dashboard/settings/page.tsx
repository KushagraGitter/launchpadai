"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { api, SubscriptionInfo, PaymentRecord } from "@/lib/api";
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
    id: "team",
    name: "Team",
    price: 49,
    description: "For startups & teams",
    features: [
      "Unlimited projects",
      "All 4 AI phases",
      "Multi-user collaboration",
      "Priority support",
      "Export artifacts",
    ],
    icon: Users,
  },
];

export default function SettingsPage() {
  const { getToken, user, refreshUser } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    const token = getToken();
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
    loadRazorpayScript();
  }, [loadData]);

  function loadRazorpayScript() {
    if (document.getElementById("razorpay-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }

  async function handleUpgrade(planId: string) {
    const token = getToken();
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
            refreshUser();
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
    const token = getToken();
    if (!token) return;
    if (!window.confirm("Are you sure you want to cancel your subscription? You will be downgraded at the end of your billing period.")) return;

    setCancelLoading(true);
    try {
      await api.subscriptions.cancel(token);
      setMessage({ type: "success", text: "Subscription cancelled. It will remain active until the end of the billing period." });
      loadData();
      refreshUser();
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
        <div className="grid gap-4 md:grid-cols-3">
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
