import  { useAuthStore } from "@/store/auth.store";
import { Navigate } from "react-router-dom";

export default function PublicRoute({ children }: { children: React.ReactNode }) {
  const {isAuthenticated,initialize} = useAuthStore()
  const hydrated = useAuthStore.persist.hasHydrated()

const isInitialized = initialize
  if (!hydrated || !isInitialized) {
    return (
      <div
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
        }}
      >
        <div
          aria-label="Loading"
          role="status"
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-full)",
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-accent)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}