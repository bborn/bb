import { describe, expect, it } from "vitest";
import {
  buildSettingsSearchCandidates,
  rankSettingsSearchCandidates,
} from "./settings-search";
import { SETTINGS_NAV_SECTIONS } from "./settings-sections";

const HOSTS = [{ id: "host_1", name: "Studio Mac" }];
const PROJECTS = [{ id: "proj_1", name: "Acme Storefront" }];

function candidatesFor(
  overrides: Partial<Parameters<typeof buildSettingsSearchCandidates>[0]> = {},
) {
  return buildSettingsSearchCandidates({
    desktopBrowserAvailable: true,
    hosts: HOSTS,
    projects: PROJECTS,
    sections: SETTINGS_NAV_SECTIONS,
    ...overrides,
  });
}

function labelsFor(query: string, candidates = candidatesFor()) {
  return rankSettingsSearchCandidates({ candidates, query }).map(
    (result) => result.candidate.label,
  );
}

describe("settings search ranking", () => {
  it("returns nothing for an empty query", () => {
    expect(labelsFor("")).toEqual([]);
    expect(labelsFor("   ")).toEqual([]);
  });

  it("finds a setting by a keyword that is absent from its label", () => {
    expect(labelsFor("dark mode")).toContain("Theme");
    expect(labelsFor("screen share")).toContain("Streamer mode");
    expect(labelsFor("worktree")).toContain("New branch prefix");
  });

  it("finds a setting by its own label", () => {
    expect(labelsFor("streamer")[0]).toBe("Streamer mode");
  });

  it("surfaces a section's settings when the section name is typed", () => {
    expect(labelsFor("experiments")).toContain("Timeline windowing");
  });

  it("matches machines and projects by name", () => {
    expect(labelsFor("Studio")).toContain("Studio Mac");
    expect(labelsFor("Storefront")).toContain("Acme Storefront");
  });

  it("targets a setting's section route with its id", () => {
    const results = rankSettingsSearchCandidates({
      candidates: candidatesFor(),
      query: "streamer",
    });
    expect(results[0]?.candidate.to).toBe(
      "/settings?setting=streamer-mode",
    );
  });

  it("targets entity routes directly", () => {
    const machine = rankSettingsSearchCandidates({
      candidates: candidatesFor(),
      query: "Studio Mac",
    })[0];
    expect(machine?.candidate.to).toBe("/settings/machines/host_1");
  });

  it("omits desktop-only settings when no desktop browser is available", () => {
    const withoutDesktop = candidatesFor({ desktopBrowserAvailable: false });
    expect(labelsFor("in-app browser", withoutDesktop)).not.toContain(
      "Open links in the in-app browser",
    );
    expect(labelsFor("in-app browser")).toContain(
      "Open links in the in-app browser",
    );
  });

  it("omits settings whose section is hidden", () => {
    const withoutFiles = candidatesFor({
      sections: SETTINGS_NAV_SECTIONS.filter(
        (section) => section.id !== "files",
      ),
    });
    expect(labelsFor("local editor", withoutFiles)).not.toContain(
      "Local editor integration",
    );
  });

  it("reports match positions against the label", () => {
    const result = rankSettingsSearchCandidates({
      candidates: candidatesFor(),
      query: "theme",
    })[0];
    expect(result?.candidate.label).toBe("Theme");
    expect(result?.positions).toEqual([0, 1, 2, 3, 4]);
  });
});
