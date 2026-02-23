"use client";

import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  CreditCard,
  BookOpen,
  MessageCircleQuestion,
  LogOut,
  Monitor,
  Sun,
  Moon,
  ChevronDown,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface ProfileDropdownProps {
  compact?: boolean;
}

export default function ProfileDropdown({ compact }: ProfileDropdownProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const planLabel = user.plan === "free" ? "Free" : user.plan === "pro" ? "Pro" : "Team";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent transition-colors outline-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-purple-600 text-[11px] font-bold text-white shrink-0">
            {initials}
          </div>
          {!compact && (
            <span className="text-sm text-foreground max-w-[100px] truncate hidden sm:block">
              {user.name}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/20 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
              <Zap className="h-2.5 w-2.5" />
              {planLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {user.project_count}/{user.project_limit} projects
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <User className="h-4 w-4 text-muted-foreground" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <Settings className="h-4 w-4 text-muted-foreground" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Billing & Plans
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href="https://docs.launchpadai.dev" target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Documentation
              <svg className="h-3 w-3 ml-auto text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="mailto:feedback@launchpadai.dev">
              <MessageCircleQuestion className="h-4 w-4 text-muted-foreground" />
              Feedback
              <svg className="h-3 w-3 ml-auto text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <div className="px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            Preferences
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Theme</span>
            <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
              <ThemeButton
                active={theme === "system"}
                onClick={() => setTheme("system")}
                title="System"
              >
                <Monitor className="h-3.5 w-3.5" />
              </ThemeButton>
              <ThemeButton
                active={theme === "light"}
                onClick={() => setTheme("light")}
                title="Light"
              >
                <Sun className="h-3.5 w-3.5" />
              </ThemeButton>
              <ThemeButton
                active={theme === "dark"}
                onClick={() => setTheme("dark")}
                title="Dark"
              >
                <Moon className="h-3.5 w-3.5" />
              </ThemeButton>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            logout();
            router.push("/auth/login");
          }}
          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`rounded-md p-1.5 transition-all ${
        active
          ? "bg-accent text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
