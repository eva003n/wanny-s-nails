import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "@/lib/api";
import { validateOrThrow } from "@/lib/guards";
import { AuthResponseSchema, MeResponseSchema } from "@/lib/schemas";
import type { User } from "@/lib/schemas";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /* `true` once Zustand persist has finished rehydrating from localStorage */
  hydrated: boolean;
  initialized: boolean;
 setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  /** Called once on app mount to re-validate the persisted session via /auth/me */
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hydrated: false,
     initialized:false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await api.post("/auth/login", { email, password });
          const { data } = response.data;
          const validated = validateOrThrow(AuthResponseSchema, data, "login");
          set({
            accessToken: validated.accessToken,
            user: validated.user,
            isAuthenticated: true,
            hydrated: true,
          });
          // Note: refreshToken is set as httpOnly cookie by the API
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
          set({ isLoading: true });
        try {
          await api.delete("/auth/logout");
        } catch {
          // Ignore errors — proceed with clearing client state
        } finally {
          set({ accessToken: null, user: null, isAuthenticated: false });
          set({ isLoading: false });

          // httpOnly cookie is cleared by the API
        }
      },

      fetchMe: async () => {
        try {
          set({ isLoading: true });
          const response = await api.get("/auth/me");
          const validated = validateOrThrow(
            MeResponseSchema,
            response.data,
            "fetchMe",
          );
          set({ user: validated.data });
        } catch {
          set({ user: null });
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Re-validate the persisted session on app load.
       *
       * After Zustand persist rehydrates `user` + `isAuthenticated` from
       * localStorage we still need a fresh access token (kept in memory only).
       *
       * Flow:
       *  1. `GET /auth/me` → 401 (no access token in memory)
       *  2. Axios interceptor catches 401 → `POST /auth/refresh` (httpOnly cookie)
       *  3. Interceptor stores new accessToken + calls `setAuth(user, token)`
       *  4. Interceptor retries the original `GET /auth/me`
       *  5. We update `user` with the fresh server data
       *
       * If the refresh cookie is expired the interceptor redirects to /login.
       */
      initialize: async () => {
        set({ isLoading: true });
        try {
          const response = await api.get("/auth/me");
          const validated = validateOrThrow(
            MeResponseSchema,
            response.data,
            "initialize",
          );

          set({ user: validated.data, isAuthenticated: true });
          set({ initialized: true });
        } catch {
          // Session invalid — clear persisted state but keep in-memory token
          // so subsequent requests can still attempt refresh via interceptor
          set({ user: null, isAuthenticated: false });
          set({ initialized: false});
        } finally {
          set({ isLoading: false });

        }
      },
    }),
    {
      name: "wannys-nails-auth",
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive data — accessToken stays in memory only
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: !!state.user ,
      }),
      // onRehydrateStorage: () => 
      //   (_state, _error) => {},
    },
  ),
);
