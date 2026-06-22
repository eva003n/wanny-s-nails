import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface UiState {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;

  sseBannerVisible: boolean;
  setSseBannerVisible: (visible: boolean) => void;

  installPromptDismissed: boolean;
  setInstallPromptDismissed: (dismissed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  showToast: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  sseBannerVisible: false,
  setSseBannerVisible: (visible) => set({ sseBannerVisible: visible }),

  installPromptDismissed: false,
  setInstallPromptDismissed: (dismissed) =>
    set({ installPromptDismissed: dismissed }),
}));
