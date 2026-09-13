import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSettingsSearchEntryId } from "./settings-search-catalog";

const APP_SOURCE_DIR = path.resolve(__dirname, "../..");

const PLUGIN_OWNED_FILES = new Set([
  path.join("components", "plugin", "PluginSettings.tsx"),
]);

const DYNAMIC_ROW_FILES = new Set([
  path.join("components", "settings", "FileOpenersSettingsSection.tsx"),
]);

const ANCHORED_COMPONENTS = [
  "SettingsWithControl",
  "ReplacementProviderSetting",
] as const;

interface RowOccurrence {
  relativePath: string;
  component: string;
  line: number;
  props: string;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      return entry === "node_modules" ? [] : listSourceFiles(absolute);
    }
    return absolute.endsWith(".tsx") && !absolute.endsWith(".test.tsx")
      ? [absolute]
      : [];
  });
}

function propsTextAt(source: string, openingIndex: number): string {
  let depth = 0;
  for (let cursor = openingIndex; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth === 0) {
      return source.slice(openingIndex, cursor);
    }
  }
  return source.slice(openingIndex);
}

function findRowOccurrences(): RowOccurrence[] {
  return listSourceFiles(APP_SOURCE_DIR).flatMap((absolute) => {
    const relativePath = path.relative(APP_SOURCE_DIR, absolute);
    if (relativePath.endsWith(".stories.tsx")) return [];
    const source = readFileSync(absolute, "utf8");
    return ANCHORED_COMPONENTS.flatMap((component) => {
      const occurrences: RowOccurrence[] = [];
      const needle = `<${component}`;
      let cursor = source.indexOf(needle);
      while (cursor !== -1) {
        const nextCharacter = source[cursor + needle.length] ?? "";
        if (/[\s>]/.test(nextCharacter)) {
          occurrences.push({
            relativePath,
            component,
            line: source.slice(0, cursor).split("\n").length,
            props: propsTextAt(source, cursor),
          });
        }
        cursor = source.indexOf(needle, cursor + 1);
      }
      return occurrences;
    });
  });
}

function settingIdLiteral(props: string): string | null {
  const literal = /settingId="([^"]+)"/.exec(props);
  return literal?.[1] ?? null;
}

function declaresSettingId(props: string): boolean {
  return /\bsettingId[=:]/.test(props);
}

describe("settings search coverage", () => {
  const occurrences = findRowOccurrences();

  it("finds the settings rows it means to police", () => {
    expect(occurrences.length).toBeGreaterThan(15);
  });

  it("anchors every built-in settings row to a catalog entry", () => {
    const unanchored = occurrences
      .filter(
        (occurrence) =>
          !PLUGIN_OWNED_FILES.has(occurrence.relativePath) &&
          !DYNAMIC_ROW_FILES.has(occurrence.relativePath) &&
          !declaresSettingId(occurrence.props),
      )
      .map(
        (occurrence) =>
          `${occurrence.relativePath}:${occurrence.line} <${occurrence.component}>`,
      );

    expect(unanchored).toEqual([]);
  });

  it("only uses setting ids that exist in the catalog", () => {
    const unknown = occurrences
      .flatMap((occurrence) => {
        const id = settingIdLiteral(occurrence.props);
        return id === null ? [] : [{ id, occurrence }];
      })
      .filter(({ id }) => !isSettingsSearchEntryId(id))
      .map(
        ({ id, occurrence }) =>
          `${occurrence.relativePath}:${occurrence.line} ${id}`,
      );

    expect(unknown).toEqual([]);
  });
});
