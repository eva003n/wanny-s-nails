/**
 * App root — routes, providers, lazy loading
 *
 * §7.1: No full-page spinners — skeleton loading only.
 * §10: Skip-to-content link enabled.
 */
import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { useSSE } from "@/hooks/useSSE";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import ToastContainer from "@/components/ui/Toast";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ServiceWorkerProvider, useServiceWorkerContext } from "@/hooks/useServiceWorkerContext";

/* Lazy loaded pages */
const Login = lazy(() => import("./pages/Login"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const BookingsPage = lazy(() => import("./pages/bookings/BookingsPage"));
const BookingDetailPage = lazy(
  () => import("./pages/bookings/BookingDetailPage"),
);
import RescheduleBookingPage from "@/pages/bookings/RescheduleBookingPage";
import CreateBookingPage from "@/pages/bookings/CreateBookingPage";
import { Button } from "./components/ui";
const CustomersPage = lazy(() => import("./pages/customers/CustomersPage"));
const CustomerDetailPage = lazy(
  () => import("./pages/customers/CustomerDetailPage"),
);
const PaymentsPage = lazy(() => import("./pages/payments/PaymentsPage"));
const PaymentDetailPage = lazy(
  () => import("./pages/payments/PaymentDetailPage"),
);
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));

/**
 * §7.1: Minimal loading indicator — NOT a full-page spinner.
 * Uses the .page class for safe area and a subtle centered pulse.
 */
function PageFallback() {
  return (
    <div
      className="page"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
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

/**
 * Calls `GET /auth/me` once on mount to re-validate the persisted session
 * and obtain a fresh access token via the silent-refresh interceptor.
 */
function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (hydrated && isAuthenticated && !hasInitialized.current) {
      hasInitialized.current = true;
      // Skip /auth/me when a fresh access token already exists (post-login).
      // initialize() is only needed to obtain a token via silent-refresh
      // when rehydrating a persisted session after a page reload.
      if (!token) {
        initialize();
      }
    }
  }, [hydrated, isAuthenticated, initialize]);

  return null;
}

function AppSSEProvider({ children }: { children: React.ReactNode }) {
  useSSE();
  return <>{children}</>;
}

const isDevMode = import.meta.env.DEV;

function AppInner() {
 const { setRegistration, setRegistrationError } = useServiceWorkerContext();

 const {
   needRefresh: [needRefresh, _setNeedRefresh],
   offlineReady: [offlineReady, _setOfflineReady],
   updateServiceWorker,
 } = useRegisterSW({
   immediate: true,
   onRegisteredSW(_swScriptUrl, registration) {
     if (registration) {
       setRegistration(registration);
     }
     if (isDevMode) {
       console.log("Service worker registered", registration);
     }
   },
   onRegisterError(error) {
     setRegistrationError(error instanceof Error ? error : new Error(String(error)));
     if (isDevMode) {
       console.error("Service worker registration failed", error);
     }
   },
 });

  return (
    <>
      <ToastContainer />

      {(needRefresh || offlineReady) && (
        <div className="toast">
          {offlineReady
            ? "App ready to work offline"
            : "New version available."}
          {needRefresh && (
            <Button onClick={() => updateServiceWorker(true)}>Reload/</Button>
          )}
        </div>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              {/* <AppSSEProvider > */}
              <Layout />
              {/* </AppSSEProvider> */}
            </ProtectedRoute>
          }
        >
          {[
            { path: "dashboard", element: <DashboardPage /> },
            { path: "bookings", element: <BookingsPage /> },
            { path: "bookings/new", element: <CreateBookingPage /> },
            { path: "bookings/:id", element: <BookingDetailPage /> },
            {
              path: "bookings/:id/reschedule",
              element: <RescheduleBookingPage />,
            },
            { path: "customers", element: <CustomersPage /> },
            { path: "customers/:id", element: <CustomerDetailPage /> },
            { path: "payments", element: <PaymentsPage /> },
            { path: "payments/:id", element: <PaymentDetailPage /> },
            { path: "settings", element: <SettingsPage /> },
            { path: "notifications", element: <NotificationsPage /> },
          ].map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={
                <ErrorBoundary>
                  <Suspense fallback={<PageFallback />}>{element}</Suspense>
                </ErrorBoundary>
              }
            />
          ))}
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppSSEProvider >
      <AuthInitializer />
      <ServiceWorkerProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </ServiceWorkerProvider>
      </AppSSEProvider>
    </QueryClientProvider>
  );
}
