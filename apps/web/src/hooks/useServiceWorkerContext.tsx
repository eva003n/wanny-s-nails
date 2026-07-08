// src/hooks/useServiceWorkerContext.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ServiceWorkerContextValue {
  registration: ServiceWorkerRegistration | null;
  registrationError: Error | null;
  setRegistration: (reg: ServiceWorkerRegistration) => void;
  setRegistrationError: (err: Error) => void;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextValue | null>(null);

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistrationState] = useState<ServiceWorkerRegistration | null>(null);
  const [registrationError, setRegistrationErrorState] = useState<Error | null>(null);

  const setRegistration = useCallback((reg: ServiceWorkerRegistration) => {
    setRegistrationState(reg);
    // Clear any previous registration error on success
    setRegistrationErrorState(null);
  }, []);

  const setRegistrationError = useCallback((err: Error) => {
    setRegistrationErrorState(err);
    // Clear registration on error — it's invalid
    setRegistrationState(null);
  }, []);

  return (
    <ServiceWorkerContext.Provider
      value={{ registration, registrationError, setRegistration, setRegistrationError }}
    >
      {children}
    </ServiceWorkerContext.Provider>
  );
}

export function useServiceWorkerContext(): ServiceWorkerContextValue {
  const ctx = useContext(ServiceWorkerContext);
  if (!ctx) {
    throw new Error(
      "useServiceWorkerContext must be used within a <ServiceWorkerProvider>",
    );
  }
  return ctx;
}