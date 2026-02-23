"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (type: ToastType, message: string, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  add: (type, message, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
