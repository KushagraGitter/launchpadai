"use client";

import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-950/30 via-surface-0 to-surface-0" />

      <div className="relative flex flex-col items-center">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <SignIn signUpUrl="/auth/signup" />
      </div>
    </div>
  );
}
