import { create } from "zustand";
import type { UserInfo } from "./api";

/**
 * Zustand auth store — simplified for Clerk.
 *
 * Clerk manages authentication, tokens, and session lifecycle.
 * This store holds the *local* user info (plan, project count, etc.)
 * fetched from our backend's GET /api/auth/me endpoint.
 */
interface AuthState {
  user: UserInfo | null;
  isLoading: boolean;
  setUser: (user: UserInfo | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isLoading: false }),
}));
