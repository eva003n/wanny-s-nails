/**
 * §3.3 Account Settings
 *
 * Change password form + logout button.
 * Logout clears tokens + service worker cache.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChangePassword, useLogout } from "../hooks/useAccount";
import { useUiStore } from "@/store/ui.store";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ChangePasswordData = z.infer<typeof ChangePasswordSchema>;

export default function AccountSection() {
  const changePassword = useChangePassword();
  const { logout } = useLogout();
  const showToast = useUiStore((s) => s.showToast);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const onSubmit = (data: ChangePasswordData) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          showToast({ type: "success", message: "Password changed successfully." });
          setShowChangePassword(false);
          reset();
        },
        onError: () => {
          showToast({ type: "error", message: "Failed to change password. Check your current password." });
        },
      },
    );
  };

  const handleLogout = async () => {
    // Clear service worker cache if available
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // Ignore cache clearing errors
      }
    }
    await logout();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
      {/* Change Password */}
      <Card>
        {showChangePassword ? (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
            <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
              Change Password
            </p>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
              error={errors.currentPassword?.message}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              error={errors.newPassword?.message}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              error={errors.confirmPassword?.message}
            />
            <div style={{ display: "flex", gap: "var(--space-8)" }}>
              <Button type="submit" loading={changePassword.isPending}>
                Update Password
              </Button>
              <Button variant="secondary" onClick={() => { setShowChangePassword(false); reset(); }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowChangePassword(true)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              minHeight: 44,
            }}
          >
            <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-text-primary)", margin: 0 }}>
              Change Password
            </p>
            <span style={{ fontSize: "14px", color: "var(--color-text-tertiary)" }}>→</span>
          </button>
        )}
      </Card>

      {/* Logout */}
      <Card>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            minHeight: 44,
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: 500, color: "var(--color-error)", margin: 0 }}>
            Log Out
          </p>
        </button>
      </Card>
    </div>
  );
}