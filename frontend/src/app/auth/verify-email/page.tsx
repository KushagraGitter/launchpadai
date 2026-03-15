"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Rocket, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token provided.");
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await api.auth.verifyEmail(token!);
        if (!cancelled) setStatus("success");
      } catch (err: unknown) {
        if (cancelled) return;
        setStatus("error");
        const apiErr = err as { data?: { detail?: string } };
        setErrorMsg(apiErr?.data?.detail || "Verification failed. The link may be invalid or expired.");
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-950/30 via-surface-0 to-surface-0" />

      <div className="relative w-full max-w-sm">
        <div className="card text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
            <Rocket className="h-5 w-5 text-white -rotate-45" />
          </div>

          {status === "verifying" && (
            <>
              <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center">
                <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
              </div>
              <h1 className="mt-6 text-xl font-bold text-foreground">Verifying your email...</h1>
              <p className="mt-2 text-sm text-muted-foreground">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="mt-6 text-xl font-bold text-foreground">Email verified!</h1>
              <p className="mt-2 text-sm text-muted-foreground">Your account is ready. You can now sign in.</p>
              <Link href="/auth/login" className="btn-primary mt-8 inline-block w-full">
                Sign in
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="mt-6 text-xl font-bold text-foreground">Verification failed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
              <div className="mt-8 space-y-3">
                <Link href="/auth/signup" className="btn-primary block w-full">
                  Sign up again
                </Link>
                <Link href="/auth/login" className="block text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
