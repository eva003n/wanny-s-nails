import axios from "axios";
import { useAuthStore } from "@/store/auth.store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 120_000,
  timeoutErrorMessage: "Network timeout",
  headers: { "Content-Type": "application/json" },
});

// Attach access token from Zustand on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const unallowedRetryUrls = ["/auth/login"];
    if (
     unallowedRetryUrls.includes(original.url)
    ) {
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.data.accessToken,
        );
        // token based auth
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Extract data from API envelope format: { data: T, meta?: PaginationMeta }
 */
export function unwrap<T>(response: { data: { data: T; meta?: PaginationMeta } }): {
  data: T;
  meta?: PaginationMeta;
} {
  return response.data;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default api;