"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useClerkSync } from "@/lib/useClerkSync";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Rocket, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Sync Clerk session → local Zustand store
  useClerkSync();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Animated aurora background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] h-[500px] w-[700px] rounded-full bg-gradient-to-br from-teal-600/[0.07] via-emerald-500/[0.05] to-transparent blur-[120px] animate-float-slow" />
        <div className="absolute top-[5%] right-[-8%] h-[400px] w-[500px] rounded-full bg-gradient-to-bl from-violet-600/[0.06] via-purple-500/[0.04] to-transparent blur-[120px] animate-float-slower" />
        <div className="absolute bottom-[-10%] left-[30%] h-[350px] w-[400px] rounded-full bg-gradient-to-tr from-blue-600/[0.05] via-cyan-500/[0.03] to-transparent blur-[100px] animate-float-slow" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Glass Navigation */}
      <nav className="sticky top-0 z-40 px-4 pt-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl px-5 py-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-lg shadow-teal-500/25">
              <Rocket className="h-4 w-4 text-white -rotate-45" />
            </div>
            <span className="text-lg font-bold text-white">
              LaunchPad<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.08] text-white font-medium"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <div className="ml-3 pl-3 border-l border-white/[0.06]">
              <UserButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="relative mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
