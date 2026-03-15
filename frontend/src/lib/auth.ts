import { create } from "zustand";
import { api, UserInfo, ApiError } from "./api";
import { useToast } from "./toast";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
}

export const useAuth = create<AuthState>((set, get) => ({
  accessToken: typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null,
  refreshToken: typeof window !== "undefined" ? sessionStorage.getItem("refresh_token") : null,
  user: null,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const res = await api.auth.login({ email, password });
      sessionStorage.setItem("access_token", res.access_token);
      sessionStorage.setItem("refresh_token", res.refresh_token);
      set({ accessToken: res.access_token, refreshToken: res.refresh_token });

      const user = await api.auth.me(res.access_token);
      set({ user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw new Error("Invalid email or password");
      }
      if (err instanceof ApiError && err.status === 403) {
        throw new Error("Please verify your email before signing in.");
      }
      useToast.getState().add("error", "Login failed. Please try again.");
      throw err;
    }
  },

  register: async (email: string, password: string, name: string) => {
    try {
      const res = await api.auth.register({ email, password, name });
      sessionStorage.setItem("access_token", res.access_token);
      sessionStorage.setItem("refresh_token", res.refresh_token);
      set({ accessToken: res.access_token, refreshToken: res.refresh_token });

      const user = await api.auth.me(res.access_token);
      set({ user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        throw new Error("An account with this email already exists");
      }
      throw err;
    }
  },

  logout: () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    set({ accessToken: null, refreshToken: null, user: null });
  },

  loadUser: async () => {
    const token = get().accessToken;
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.auth.me(token);
      set({ user, isLoading: false });
    } catch {
      set({ accessToken: null, refreshToken: null, user: null, isLoading: false });
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("refresh_token");
    }
  },

  refreshUser: async () => {
    const token = get().accessToken;
    if (!token) return;
    try {
      const user = await api.auth.me(token);
      set({ user });
    } catch {
      // non-critical
    }
  },

  getToken: () => get().accessToken,
}));
