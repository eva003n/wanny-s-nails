import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useNavigate } from "react-router-dom";

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      await api.post("/auth/change-password", input);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return {
    logout: async () => {
      try {
        await logout();
      } catch {
        // Clear state regardless
      }
      clearAuth();
      navigate("/login", { replace: true });
    },
  };
}