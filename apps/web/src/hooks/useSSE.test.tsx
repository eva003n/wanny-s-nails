import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSSE } from "./useSSE";
import { subscribeSSE } from "@/lib/sse";

vi.mock("@/lib/sse");

const mockedSubscribeSSE = vi.mocked(subscribeSSE);

function createWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSSE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to SSE events on mount", () => {
    mockedSubscribeSSE.mockReturnValue(() => {});

    renderHook(() => useSSE(), { wrapper: createWrapper() });

    expect(mockedSubscribeSSE).toHaveBeenCalledTimes(4);
  });

  it("calls unsubscribe functions on cleanup", () => {
    const unsub = vi.fn();
    mockedSubscribeSSE.mockReturnValue(unsub);

    const { unmount } = renderHook(() => useSSE(), {
      wrapper: createWrapper(),
    });
    unmount();

    expect(unsub).toHaveBeenCalledTimes(4);
  });
});