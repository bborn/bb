// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingHighlight } from "./useSettingHighlight";

function addSettingRow(settingId: string): HTMLElement {
  const row = document.createElement("div");
  row.setAttribute("data-setting-id", settingId);
  document.body.append(row);
  return row;
}

function renderHighlight(initialEntry: string) {
  return renderHook(() => useSettingHighlight(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("useSettingHighlight", () => {
  it("highlights nothing without a setting parameter", () => {
    addSettingRow("streamer-mode");
    const { result } = renderHighlight("/settings");
    expect(result.current).toBeNull();
  });

  it("highlights the requested setting and scrolls it into view", () => {
    const row = addSettingRow("streamer-mode");
    const { result } = renderHighlight("/settings?setting=streamer-mode");

    expect(result.current).toBe("streamer-mode");
    expect(row.scrollIntoView).toHaveBeenCalled();
  });

  it("keeps the highlight after the setting parameter is stripped", () => {
    addSettingRow("streamer-mode");
    const { result } = renderHighlight("/settings?setting=streamer-mode");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("streamer-mode");
  });

  it("clears the highlight once it has been shown", () => {
    addSettingRow("streamer-mode");
    const { result } = renderHighlight("/settings?setting=streamer-mode");

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(result.current).toBeNull();
  });

  it("preserves other query parameters when stripping the setting", () => {
    addSettingRow("streamer-mode");
    const { result } = renderHighlight(
      "/settings?view=installed&setting=streamer-mode",
    );

    expect(result.current).toBe("streamer-mode");
  });

  it("highlights a row that mounts after navigation", async () => {
    const { result } = renderHighlight("/settings?setting=streamer-mode");
    expect(result.current).toBeNull();

    await act(async () => {
      addSettingRow("streamer-mode");
    });

    expect(result.current).toBe("streamer-mode");
  });
});
