import { create } from "zustand";
import api from "../lib/api.js";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem("accessToken"),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post("/auth/login", { email, password });
      const { data } = response.data;
      set({ accessToken: data.accessToken, user: data.user });
      localStorage.setItem("accessToken", data.accessToken);
      // Note: refreshToken is set as httpOnly cookie by the API
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors — proceed with clearing client state
    } finally {
      set({ accessToken: null, user: null });
      localStorage.removeItem("accessToken");
      // httpOnly cookie is cleared by the API
    }
  },

  refresh: async () => {
    try {
      const response = await api.post("/auth/refresh", {});
      const { data } = response.data;
      set({ accessToken: data.accessToken });
      localStorage.setItem("accessToken", data.accessToken);
      return true;
    } catch {
      set({ accessToken: null, user: null });
      localStorage.removeItem("accessToken");
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const response = await api.get("/auth/me");
      set({ user: response.data.data });
    } catch {
      set({ user: null });
    }
  },
}));