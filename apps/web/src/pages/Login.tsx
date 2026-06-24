/**
 * §6.1 Login Page
 *
 * Uses Input component with labels above.
 * §6.3: Primary button 52px, full width.
 * §3.1: Max width 480px centered.
 * §9.1: Standalone page (no bottom nav).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Sparkles } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message ?? "Login failed. Check your credentials.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-canvas)",
        padding: "var(--space-16)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: 480,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-32)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div className="flex  h-16 w-16 items-center justify-center rounded-md bg-primary-light text-primary text-center">
          <Sparkles className="h-8 w-8 " aria-hidden="true" />
        </div>
        {/* §9.1 Brand */}
        <h1
          style={{
            fontSize: "28px",
            lineHeight: "34px",
            letterSpacing: "-0.3px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            textAlign: "center",
            margin: "0 0 var(--space-8)",
          }}
        >
          Wanny's Nails
        </h1>
        <p
          style={{
            fontSize: "16px",
            lineHeight: "22px",
            color: "var(--color-text-secondary)",
            textAlign: "center",
            margin: "0 0 var(--space-32)",
          }}
        >
          Sign in to your account
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-20)",
          }}
          noValidate
        >
          {/* §7.3 Error display */}
          {error && (
            <div
              role="alert"
              style={{
                background: "var(--color-error-bg)",
                color: "var(--color-error)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-12) var(--space-16)",
                fontSize: "14px",
                lineHeight: "20px",
              }}
            >
              {error}
            </div>
          )}

          {/* §6.1 Email input with label above */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          {/* §6.1 Password input with label above */}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {/* §6.3 Primary button */}
          <Button type="submit" loading={isLoading}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}