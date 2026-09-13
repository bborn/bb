import { describe, expect, it } from "vitest";
import {
  parseSettingsSearchLimit,
  searchSettingsCatalog,
} from "../../commands/settings-search.js";

function labels(query: string, limit?: number): string[] {
  return searchSettingsCatalog(query, limit).map((result) => result.label);
}

describe("bb settings search", () => {
  it("finds a setting by a keyword absent from its label", () => {
    expect(labels("dark mode")).toContain("Theme");
    expect(labels("screen share")).toContain("Streamer mode");
    expect(labels("worktree")).toContain("New branch prefix");
  });

  it("finds a setting by its own label", () => {
    expect(labels("streamer")[0]).toBe("Streamer mode");
  });

  it("reports the owning section for each result", () => {
    const [result] = searchSettingsCatalog("streamer");
    expect(result?.section).toBe("General");
    expect(result?.sectionId).toBe("general");
    expect(result?.id).toBe("streamer-mode");
  });

  it("surfaces a section's settings when the section name is typed", () => {
    expect(labels("experiments")).toContain("Timeline windowing");
  });

  it("returns the head of the catalog for an empty query", () => {
    expect(searchSettingsCatalog("   ", 3)).toHaveLength(3);
  });

  it("honors the limit", () => {
    expect(searchSettingsCatalog("s", 2)).toHaveLength(2);
    expect(searchSettingsCatalog("s", 0)).toEqual([]);
  });

  it("returns nothing when no setting matches", () => {
    expect(searchSettingsCatalog("zzzzzznotasetting")).toEqual([]);
  });

  it("rejects a non-positive or unparseable limit", () => {
    expect(parseSettingsSearchLimit("5")).toBe(5);
    expect(() => parseSettingsSearchLimit("0")).toThrow("positive integer");
    expect(() => parseSettingsSearchLimit("abc")).toThrow("positive integer");
  });
});
