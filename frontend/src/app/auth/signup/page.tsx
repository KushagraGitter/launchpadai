"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Rocket, ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const register = useAuth((s) => s.register);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-950/30 via-surface-0 to-surface-0" />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="card">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600">
              <Rocket className="h-5 w-5 text-white -rotate-45" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-foreground">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start building with your AI co-founder</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>
            )}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field mt-1.5"
                autoComplete="name"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1.5"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1.5"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
