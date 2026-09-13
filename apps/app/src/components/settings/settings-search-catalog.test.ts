import { describe, expect, it } from "vitest";
import {
  SETTINGS_SEARCH_CATALOG,
  SETTING_LABEL,
  isSettingsSearchEntryId,
} from "./settings-search-catalog";
import { isSettingsSectionId } from "./settings-sections";

describe("settings search catalog", () => {
  it("gives every entry a unique kebab-case id", () => {
    const ids = SETTINGS_SEARCH_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const malformed = ids.filter((id) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id));
    expect(malformed).toEqual([]);
  });

  it("points every entry at a real settings section", () => {
    const orphans = SETTINGS_SEARCH_CATALOG.filter(
      (entry) => !isSettingsSectionId(entry.sectionId),
    ).map((entry) => entry.id);
    expect(orphans).toEqual([]);
  });

  it("gives every entry a non-empty label and distinct keywords", () => {
    for (const entry of SETTINGS_SEARCH_CATALOG) {
      expect(entry.label.trim()).not.toBe("");
      expect(new Set(entry.keywords).size).toBe(entry.keywords.length);
      expect(
        entry.keywords.some(
          (keyword) => keyword.toLowerCase() === entry.label.toLowerCase(),
        ),
      ).toBe(false);
    }
  });

  it("exposes labels by id and recognizes only catalog ids", () => {
    for (const entry of SETTINGS_SEARCH_CATALOG) {
      expect(SETTING_LABEL[entry.id]).toBe(entry.label);
      expect(isSettingsSearchEntryId(entry.id)).toBe(true);
    }
    expect(isSettingsSearchEntryId("not-a-setting")).toBe(false);
  });
});
