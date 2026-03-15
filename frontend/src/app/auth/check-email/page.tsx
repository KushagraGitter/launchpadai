"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Rocket, Mail, ArrowLeft, Loader2 } from "lucide-react";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      await api.auth.resendVerification(email);
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-950/30 via-surface-0 to-surface-0" />

      <div className="relative w-full max-w-sm">
        <Link href="/auth/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="card text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
            <Rocket className="h-5 w-5 text-white -rotate-45" />
          </div>

          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Mail className="h-8 w-8 text-emerald-400" />
          </div>

          <h1 className="mt-6 text-xl font-bold text-foreground">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            We sent a verification link to{" "}
            {email ? <span className="font-medium text-foreground">{email}</span> : "your email"}.
            <br />
            Click the link to activate your account.
          </p>

          <div className="mt-8 space-y-3">
            {resent ? (
              <p className="text-sm text-green-400">Verification email resent!</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending || !email}
                className="btn-primary w-full"
              >
                {resending ? "Sending..." : "Resend verification email"}
              </button>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <button onClick={handleResend} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              try again
            </button>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <CheckEmailContent />
    </Suspense>
  );
}
