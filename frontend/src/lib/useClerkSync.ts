"use client";

import { useEffect, useRef } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/nextjs";
import { useAuth } from "./auth";
import { api } from "./api";

/**
 * Hook that syncs Clerk auth state to the local Zustand store.
 *
 * On sign-in: fetches user info from our backend (GET /api/auth/me)
 * and populates the Zustand store with plan, project count, etc.
 *
 * On sign-out: clears the Zustand store.
 *
 * Place this once in the dashboard layout.
 */
export function useClerkSync() {
  const { isSignedIn, getToken, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { setUser, setLoading } = useAuth();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setUser(null);
      fetchedRef.current = false;
      return;
    }

    // Avoid double-fetching
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const userInfo = await api.auth.me(token);
          setUser(userInfo);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    })();
  }, [isLoaded, isSignedIn, clerkUser, getToken, setUser, setLoading]);

  return { isLoaded, isSignedIn, getToken };
}
