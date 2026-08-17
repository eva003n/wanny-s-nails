import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "./auth.store";
import api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe("auth.store (TESTING.md §5.3 — Zustand store logic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      hydrated: false,
      initialized: false,
    });
  });

  describe("setAuth", () => {
    it("sets the user and marks as authenticated", () => {
      const user = {
        id: "user-1",
        name: "Wanny",
        email: "wanny@example.com",
        role: "OWNER" as const,
      };
      useAuthStore.getState().setAuth(user, "token-123");

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.accessToken).toBe("token-123");
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("clearAuth", () => {
    it("clears user and token", () => {
      useAuthStore.setState({
        user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
        accessToken: "token",
        isAuthenticated: true,
      });

      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("login", () => {
    it("sets auth state on successful login", async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            accessToken: "access-token",
            user: {
              id: "user-1",
              name: "Wanny",
              email: "wanny@example.com",
              role: "OWNER",
            },
          },
        },
      });

      await useAuthStore.getState().login("wanny@example.com", "Admin123!");

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("access-token");
      expect(state.user?.email).toBe("wanny@example.com");
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("calls the API with the correct payload", async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            accessToken: "access-token",
            user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
          },
        },
      });

      await useAuthStore.getState().login("wanny@example.com", "Admin123!");

      expect(mockedApi.post).toHaveBeenCalledWith("/auth/login", {
        email: "wanny@example.com",
        password: "Admin123!",
      });
    });

    it("does not set auth state on failed login", async () => {
      mockedApi.post.mockRejectedValue(new Error("Invalid credentials"));

      await expect(
        useAuthStore.getState().login("wanny@example.com", "wrong"),
      ).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("logout", () => {
    it("clears auth state on logout", async () => {
      mockedApi.delete.mockResolvedValue({});

      useAuthStore.setState({
        user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
        accessToken: "token",
        isAuthenticated: true,
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("clears state even if the API call fails", async () => {
      mockedApi.delete.mockRejectedValue(new Error("Network error"));

      useAuthStore.setState({
        user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
        accessToken: "token",
        isAuthenticated: true,
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("fetchMe", () => {
    it("updates the user from the API", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          data: {
            id: "user-1",
            name: "Wanny",
            email: "wanny@example.com",
            role: "OWNER",
          },
        },
      });

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(state.user?.name).toBe("Wanny");
      expect(state.isLoading).toBe(false);
    });

    it("clears the user on API failure", async () => {
      mockedApi.get.mockRejectedValue(new Error("Unauthorized"));

      useAuthStore.setState({
        user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
      });

      await useAuthStore.getState().fetchMe();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });
  });

  describe("initialize", () => {
    it("sets authenticated on successful session validation", async () => {
      mockedApi.get.mockResolvedValue({
        data: {
          data: {
            id: "user-1",
            name: "Wanny",
            email: "wanny@example.com",
            role: "OWNER",
          },
        },
      });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.initialized).toBe(true);
      expect(state.user?.email).toBe("wanny@example.com");
    });

    it("clears auth on failed session validation", async () => {
      mockedApi.get.mockRejectedValue(new Error("Session expired"));

      useAuthStore.setState({
        user: { id: "u1", name: "W", email: "w@e.com", role: "OWNER" },
        isAuthenticated: true,
      });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });
});