import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useUiStore } from "./ui.store";

describe("ui.store (TESTING.md §5.3 — Zustand store logic)", () => {
  beforeEach(() => {
    useUiStore.setState({
      toasts: [],
      sseBannerVisible: false,
      installPromptDismissed: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("showToast", () => {
    it("adds a toast to the list", () => {
      useUiStore.getState().showToast({ type: "success", message: "Saved" });

      const toasts = useUiStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]?.type).toBe("success");
      expect(toasts[0]?.message).toBe("Saved");
      expect(toasts[0]?.id).toBeTruthy();
    });

    it("auto-dismisses a toast after 3 seconds", () => {
      vi.useFakeTimers();
      useUiStore.getState().showToast({ type: "error", message: "Failed" });

      expect(useUiStore.getState().toasts).toHaveLength(1);

      vi.advanceTimersByTime(3000);

      expect(useUiStore.getState().toasts).toHaveLength(0);
    });

    it("adds multiple toasts", () => {
      useUiStore.getState().showToast({ type: "info", message: "First" });
      useUiStore.getState().showToast({ type: "warning", message: "Second" });

      expect(useUiStore.getState().toasts).toHaveLength(2);
    });
  });

  describe("dismissToast", () => {
    it("removes a toast by id", () => {
      useUiStore.getState().showToast({ type: "info", message: "Test" });
      const id = useUiStore.getState().toasts[0]?.id!;

      useUiStore.getState().dismissToast(id);

      expect(useUiStore.getState().toasts).toHaveLength(0);
    });

    it("does nothing for an unknown id", () => {
      useUiStore.getState().showToast({ type: "info", message: "Test" });

      useUiStore.getState().dismissToast("unknown-id");

      expect(useUiStore.getState().toasts).toHaveLength(1);
    });
  });

  describe("sseBannerVisible", () => {
    it("defaults to false", () => {
      expect(useUiStore.getState().sseBannerVisible).toBe(false);
    });

    it("sets the banner visibility", () => {
      useUiStore.getState().setSseBannerVisible(true);
      expect(useUiStore.getState().sseBannerVisible).toBe(true);

      useUiStore.getState().setSseBannerVisible(false);
      expect(useUiStore.getState().sseBannerVisible).toBe(false);
    });
  });

  describe("installPromptDismissed", () => {
    it("defaults to false", () => {
      expect(useUiStore.getState().installPromptDismissed).toBe(false);
    });

    it("sets the dismissed state", () => {
      useUiStore.getState().setInstallPromptDismissed(true);
      expect(useUiStore.getState().installPromptDismissed).toBe(true);
    });
  });
});