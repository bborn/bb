import {
  SETTINGS_CATALOG_ENTRIES,
  settingsCatalogAliases,
  settingsSectionLabel,
  type SettingsCatalogEntry,
} from "@bb/client-core";
import { fuzzyMatchText } from "@bb/fuzzy-match";

export const SETTINGS_SEARCH_DEFAULT_LIMIT = 20;

export interface SettingsSearchResult {
  id: string;
  label: string;
  section: string;
  sectionId: string;
  keywords: readonly string[];
}

function toResult(entry: SettingsCatalogEntry): SettingsSearchResult {
  return {
    id: entry.id,
    label: entry.label,
    section: settingsSectionLabel(entry.sectionId),
    sectionId: entry.sectionId,
    keywords: entry.keywords,
  };
}

export function searchSettingsCatalog(
  query: string,
  limit = SETTINGS_SEARCH_DEFAULT_LIMIT,
): SettingsSearchResult[] {
  if (limit <= 0) return [];
  const trimmed = query.trim();
  if (trimmed === "") {
    return SETTINGS_CATALOG_ENTRIES.slice(0, limit).map(toResult);
  }

  return fuzzyMatchText({
    items: [...SETTINGS_CATALOG_ENTRIES],
    query: trimmed,
    getText: (entry) => entry.label,
    getAliases: (entry) => [...settingsCatalogAliases(entry)],
    limit,
  })
    .sort((left, right) => right.score - left.score)
    .map((match) => toResult(match.item));
}

export function parseSettingsSearchLimit(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer.");
  }
  return parsed;
}
