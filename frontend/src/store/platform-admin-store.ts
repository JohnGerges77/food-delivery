import { create } from "zustand";
import { loginAdmin, logoutAdmin, restoreAdmin, PlatformApiError,
  type PlatformAdmin } from "../services/platform-admin-service.ts";

type Status = "loading" | "authenticated" | "unauthenticated" | "unavailable";
interface State {
  status: Status; admin: PlatformAdmin | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
let pending: Promise<void> | null = null;
let generation = 0;
export const usePlatformAdmin = create<State>((set) => ({
  status: "loading", admin: null,
  restore: () => {
    if (pending) return pending;
    const current = ++generation;
    set({ status: "loading", admin: null });
    pending = (async () => {
      try {
        const result = await restoreAdmin();
        if (current === generation) set({ status: "authenticated", admin: result.admin });
      } catch (error) {
        if (current === generation) set({ status: error instanceof PlatformApiError &&
          error.status === 401 ? "unauthenticated" : "unavailable", admin: null });
      }
    })().finally(() => { pending = null; });
    return pending;
  },
  login: async (email, password) => {
    const current = ++generation;
    try {
      const result = await loginAdmin(email, password);
      if (current === generation) set({ status: "authenticated", admin: result.admin });
    } catch (error) {
      if (current === generation) set({ status: "unauthenticated", admin: null });
      throw error;
    }
  },
  logout: async () => {
    const current = ++generation;
    set({ status: "loading", admin: null });
    try { await logoutAdmin();
      if (current === generation) set({ status: "unauthenticated", admin: null });
    } catch (error) {
      if (current === generation) set({ status: error instanceof PlatformApiError &&
        error.status === 401 ? "unauthenticated" : "unavailable", admin: null });
      throw error;
    }
  },
}));
