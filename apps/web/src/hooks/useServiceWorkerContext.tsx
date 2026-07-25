// src/hooks/useServiceWorkerContext.tsx
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";

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

  // Track whether the component has mounted to avoid state updates on unmounted component
  const mountedRef = useRef(false);
  // Queue pending values that were set before mount
  const pendingRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const pendingErrorRef = useRef<Error | null>(null);

  const setRegistration = useCallback((reg: ServiceWorkerRegistration) => {
    if (mountedRef.current) {
      setRegistrationState(reg);
      // Clear any previous registration error on success
      setRegistrationErrorState(null);
    } else {
      // Queue for after mount
      pendingRegistrationRef.current = reg;
      pendingErrorRef.current = null;
    }
  }, []);

  const setRegistrationError = useCallback((err: Error) => {
    if (mountedRef.current) {
      setRegistrationErrorState(err);
      // Clear registration on error — it's invalid
      setRegistrationState(null);
    } else {
      // Queue for after mount
      pendingErrorRef.current = err;
      pendingRegistrationRef.current = null;
    }
  }, []);

  // Apply any queued values once the component mounts
  useEffect(() => {
    mountedRef.current = true;

    if (pendingRegistrationRef.current !== null) {
      setRegistrationState(pendingRegistrationRef.current);
      setRegistrationErrorState(null);
      pendingRegistrationRef.current = null;
    }

    if (pendingErrorRef.current !== null) {
      setRegistrationErrorState(pendingErrorRef.current);
      setRegistrationState(null);
      pendingErrorRef.current = null;
    }

    return () => {
      mountedRef.current = false;
    };
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