// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SETTINGS_NAV_SECTIONS } from "./settings-sections";
import { SettingsSidebarContent } from "./SettingsSidebar";

vi.mock("@/lib/bb-desktop", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bb-desktop")>()),
  isDesktopBrowserAvailable: () => false,
}));

vi.mock("@/lib/native-shell", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/native-shell")>()),
  canOpenNativeScreen: () => false,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SidebarProvider>
        <SettingsSidebarContent
          appRoutePath="/"
          isResizing={false}
          mobileHosted
          navigation={{
            activePluginId: null,
            activeSection: "general",
            pluginEntries: [],
            searchHosts: [{ id: "host_1", name: "Studio Mac" }],
            searchProjects: [{ id: "proj_1", name: "Acme Storefront" }],
            sections: SETTINGS_NAV_SECTIONS,
          }}
          onResizeMouseDown={() => {}}
        />
      </SidebarProvider>
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function searchFor(query: string): HTMLElement {
  const input = screen.getByLabelText("Search settings");
  fireEvent.change(input, { target: { value: query } });
  return input;
}

afterEach(cleanup);

describe("settings sidebar search", () => {
  it("shows the section list until a query is typed", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(screen.queryByTestId("settings-search-results")).toBeNull();
  });

  it("replaces the section list with ranked settings results", () => {
    renderSidebar();
    searchFor("dark mode");

    const results = screen.getByTestId("settings-search-results");
    expect(within(results).getByRole("option", { name: /Theme/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Appearance" })).toBeNull();
  });

  it("navigates to the owning section with the setting in the URL", () => {
    renderSidebar();
    searchFor("streamer");
    fireEvent.click(screen.getByRole("option", { name: /Streamer mode/ }));

    expect(screen.getByTestId("location").textContent).toBe(
      "/settings?setting=streamer-mode",
    );
  });

  it("opens the active result on Enter and moves with arrow keys", () => {
    renderSidebar();
    const input = searchFor("sidebar");

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(
      screen.getAllByRole("option")[1]?.getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("location").textContent).toContain("/settings");
  });

  it("matches projects by name and targets the project route", () => {
    renderSidebar();
    searchFor("Storefront");
    fireEvent.click(screen.getByRole("option", { name: /Acme Storefront/ }));

    expect(screen.getByTestId("location").textContent).toBe(
      "/settings/projects/proj_1",
    );
  });

  it("matches machines by name and targets the machine route", () => {
    renderSidebar();
    searchFor("Studio Mac");
    fireEvent.click(screen.getByRole("option", { name: /Studio Mac/ }));

    expect(screen.getByTestId("location").textContent).toBe(
      "/settings/machines/host_1",
    );
  });

  it("restores the section list when the query is cleared with Escape", () => {
    renderSidebar();
    const input = searchFor("theme");
    expect(screen.getByTestId("settings-search-results")).toBeTruthy();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("settings-search-results")).toBeNull();
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
  });

  it("reports when nothing matches", () => {
    renderSidebar();
    searchFor("zzzzzznotasetting");
    expect(screen.getByTestId("settings-search-empty")).toBeTruthy();
  });

  it("omits settings that need a desktop browser", () => {
    renderSidebar();
    searchFor("in-app browser");
    expect(
      screen.queryByRole("option", {
        name: /Open links in the in-app browser/,
      }),
    ).toBeNull();
  });
});
