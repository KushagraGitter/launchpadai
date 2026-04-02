import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelative(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export const PHASE_LABELS: Record<string, string> = {
  validation: "Idea Validation",
  prd: "PRD Generation",
  coding_context: "Coding Context",
  gtm: "Go-to-Market",
};

export const PHASE_ORDER = ["validation", "prd", "coding_context", "gtm"] as const;

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-brand-500/15 text-brand-300",
  completed: "bg-green-500/15 text-green-400",
  failed: "bg-red-500/15 text-red-400",
  pending: "bg-muted text-muted-foreground",
  queued: "bg-amber-500/15 text-amber-400",
  running: "bg-blue-500/15 text-blue-400",
};
