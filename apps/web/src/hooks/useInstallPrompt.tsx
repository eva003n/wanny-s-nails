// hooks/useInstallPrompt.js
import type { BeforeInstallPromptEvent } from "@/types/global";
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from "react";

// eslint-disable-next-line react-refresh/only-export-components
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      // stop the browser's default mini-info bar
      event.preventDefault();
      // stash the event so we can trigger it later, e.g. on button click
      setInstallEvent(event);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);


    // if the app gets installed, clear state so you can hide the button
    const installedHandler = () => {
      setIsInstallable(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // outcome is 'accepted' or 'dismissed'
    setInstallEvent(null);
    setIsInstallable(outcome === "accepted" ? false : true);
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches); 

    return outcome;
  }, [installEvent]);

  return { isInstallable, isInstalled, promptInstall };
}

export interface InstallPromptContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | undefined>;
}

const InstallPromptContext = createContext<InstallPromptContextValue | null>(
  null,
);

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const value = useInstallPrompt(); // { isInstallable, isInstalled, promptInstall }

  return (
    <InstallPromptContext.Provider value={value}>
      {children}
    </InstallPromptContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInstallPromptContext() {
  const context = useContext(InstallPromptContext);
  if (!context) {
    throw new Error(
      "useInstallPromptContext must be used within InstallPromptProvider",
    );
  }
  return context;
}
