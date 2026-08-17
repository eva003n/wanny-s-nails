/**
 * §6.1 Login Page

 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import {z} from "zod"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const loginFormSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72)
  /* .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {message: "Password must be at least 8 characters long, include one uppercase letter, one lowercase letter, one number, and one special character."}) */
})

type LoginData = z.infer<typeof loginFormSchema>

export default function Login() {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginFormSchema),
  });
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginData) => {
    // e.preventDefault();

    try {
      await login(data.email, data.password);
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
          onSubmit={handleSubmit(onSubmit)}
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
            {...register("email")}
            error={errors.email?.message}
            required
            autoComplete="email"
          />

          {/* §6.1 Password input with label above */}
          <Input
            label="Password"
            type="password"
            {...register("password")}
            error={errors.password?.message}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={isLoading}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}