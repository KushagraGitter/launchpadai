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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 via-brand-500 to-purple-600">
              <Rocket className="h-4 w-4 text-white -rotate-45" />
            </div>
            <span className="text-lg font-bold text-foreground">LaunchPad<span className="bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <ProfileDropdown />
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
