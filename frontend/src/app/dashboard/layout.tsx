"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Rocket, Settings } from "lucide-react";
import ProfileDropdown from "@/components/ui/ProfileDropdown";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, loadUser, accessToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth/login");
    }
  }, [isLoading, accessToken, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-teal-600/[0.02] blur-[100px]" />
      </div>

      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
              <Rocket className="h-4 w-4 text-white -rotate-45" />
            </div>
            <span className="text-lg font-bold text-foreground">LaunchPad<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI</span></span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="ml-2">
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </nav>
      <main className="relative mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
