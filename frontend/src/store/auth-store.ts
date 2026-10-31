import { create } from "zustand";
import { ApiError, clearCsrfToken } from "../services/api-client.ts";
import { loginOwner, logoutOwner, restoreOwner, type OwnerAuth } from "../services/auth-service.ts";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

export function dashboardAccess(status: AuthStatus, onLoginRoute: boolean) {
  if (onLoginRoute) return "login";
  if (status === "unauthenticated") return "redirect";
  return status === "authenticated" ? "show" : "wait";
}

interface AuthState {
  status: AuthStatus;
  context: OwnerAuth | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateRestaurantSummary: (restaurant: OwnerAuth["restaurant"]) => void;
}

let pendingRestore: Promise<void> | null = null;
let generation = 0;

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  context: null,
  updateRestaurantSummary: (restaurant) => set((state) =>
    state.status === "authenticated" && state.context?.restaurant.id === restaurant.id
      ? { context: { ...state.context, restaurant } }
      : state),
  restore: () => {
    if (pendingRestore) return pendingRestore;
    const current = ++generation;
    set({ status: "loading", context: null });
    pendingRestore = (async () => {
      try {
        const context = await restoreOwner();
        if (current === generation) set({ status: "authenticated", context });
      } catch (error) {
        if (current !== generation) return;
        clearCsrfToken();
        set({ status: error instanceof ApiError && error.status === 401 ? "unauthenticated" : "unavailable", context: null });
      }
    })().finally(() => { pendingRestore = null; });
    return pendingRestore;
  },
  login: async (email, password) => {
    const current = ++generation;
    try {
      const context = await loginOwner(email, password);
      if (current === generation) set({ status: "authenticated", context });
    } catch (error) {
      if (current === generation) set({ status: "unauthenticated", context: null });
      throw error;
    }
  },
  logout: async () => {
    const current = ++generation;
    set({ status: "loading", context: null });
    try {
      await logoutOwner();
      if (current === generation) set({ status: "unauthenticated", context: null });
    } catch (error) {
      if (current === generation) {
        if (error instanceof ApiError && error.status === 401) {
          clearCsrfToken();
          set({ status: "unauthenticated", context: null });
          return;
        }
        set({ status: "unavailable", context: null });
      }
      throw error;
    }
  },
}));
