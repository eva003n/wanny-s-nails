import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

/**
 * Wraps every authenticated route.
 *
 * While Zustand persist is rehydrating from localStorage (`hydrated === false`),
 * we show a minimal loading indicator instead of flashing to the login page.
 * Once hydrated we check `isAuthenticated` — which is persisted across refreshes.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
          minHeight: "100vh",
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}