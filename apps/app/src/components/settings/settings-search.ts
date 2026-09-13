import { useMemo } from "react";
import { fuzzyMatchText } from "@bb/fuzzy-match";
import {
  getSettingsMachineRoutePath,
  getSettingsProjectRoutePath,
} from "@/lib/route-paths";
import { isDesktopBrowserAvailable } from "@/lib/bb-desktop";
import {
  SETTINGS_SEARCH_ENTRIES,
  type SettingsSearchEntry,
} from "./settings-search-catalog";
import {
  SETTINGS_NAV_SECTIONS,
  getSettingsSectionRoutePath,
  type SettingsNavSection,
  type SettingsSectionId,
} from "./settings-sections";

export const SETTINGS_SEARCH_RESULT_LIMIT = 20;

export type SettingsSearchResultKind = "setting" | "machine" | "project";

export interface SettingsSearchCandidate {
  id: string;
  kind: SettingsSearchResultKind;
  label: string;
  keywords: readonly string[];
  sectionLabel: string;
  to: string;
}

export interface SettingsSearchResult {
  candidate: SettingsSearchCandidate;
  positions: readonly number[];
}

interface BuildSettingsSearchCandidatesArgs {
  desktopBrowserAvailable: boolean;
  hosts: readonly { id: string; name: string }[];
  projects: readonly { id: string; name: string }[];
  sections: readonly SettingsNavSection[];
}

function sectionLabelOf(
  sections: readonly SettingsNavSection[],
  sectionId: SettingsSectionId,
): string | null {
  return sections.find((section) => section.id === sectionId)?.label ?? null;
}

function settingTarget(entry: SettingsSearchEntry): string {
  const sectionPath = getSettingsSectionRoutePath(entry.sectionId);
  return `${sectionPath}?setting=${encodeURIComponent(entry.id)}`;
}

export function buildSettingsSearchCandidates(
  args: BuildSettingsSearchCandidatesArgs,
): SettingsSearchCandidate[] {
  const settingCandidates = SETTINGS_SEARCH_ENTRIES.flatMap((entry) => {
    if (
      entry.requirement === "desktopBrowser" &&
      !args.desktopBrowserAvailable
    ) {
      return [];
    }
    const sectionLabel = sectionLabelOf(args.sections, entry.sectionId);
    if (sectionLabel === null) {
      return [];
    }
    return [
      {
        id: entry.id,
        kind: "setting" as const,
        label: entry.label,
        keywords: entry.keywords,
        sectionLabel,
        to: settingTarget(entry),
      },
    ];
  });

  const machinesAvailable =
    sectionLabelOf(args.sections, "machines") !== null;
  const machineCandidates = machinesAvailable
    ? args.hosts.map((host) => ({
        id: `machine:${host.id}`,
        kind: "machine" as const,
        label: host.name,
        keywords: ["machine", "host"] as readonly string[],
        sectionLabel: "Machines",
        to: getSettingsMachineRoutePath(host.id),
      }))
    : [];

  const projectsAvailable = sectionLabelOf(args.sections, "projects") !== null;
  const projectCandidates = projectsAvailable
    ? args.projects.map((project) => ({
        id: `project:${project.id}`,
        kind: "project" as const,
        label: project.name,
        keywords: ["project", "repository"] as readonly string[],
        sectionLabel: "Projects",
        to: getSettingsProjectRoutePath(project.id),
      }))
    : [];

  return [...settingCandidates, ...machineCandidates, ...projectCandidates];
}

function matchPositions(label: string, query: string): number[] {
  const positions: number[] = [];
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  let cursor = 0;
  for (const character of needle) {
    if (character === " ") continue;
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return [];
    positions.push(found);
    cursor = found + 1;
  }
  return positions;
}

export function rankSettingsSearchCandidates(args: {
  candidates: readonly SettingsSearchCandidate[];
  query: string;
}): SettingsSearchResult[] {
  const query = args.query.trim();
  if (query === "") {
    return [];
  }

  const matches = fuzzyMatchText({
    items: args.candidates,
    query,
    getText: (candidate) => candidate.label,
    getAliases: (candidate) => [
      ...candidate.keywords,
      candidate.sectionLabel,
    ],
    limit: SETTINGS_SEARCH_RESULT_LIMIT,
  });

  return [...matches]
    .sort((left, right) => right.score - left.score)
    .map((match) => ({
      candidate: match.item,
      positions: matchPositions(match.item.label, query),
    }));
}

export interface SettingsSearchNamedEntity {
  id: string;
  name: string;
}

export function useSettingsSearchResults(args: {
  hosts: readonly SettingsSearchNamedEntity[];
  projects: readonly SettingsSearchNamedEntity[];
  query: string;
  sections: readonly SettingsNavSection[];
}): SettingsSearchResult[] {
  const desktopBrowserAvailable = isDesktopBrowserAvailable();
  const { hosts, projects, query, sections } = args;

  const candidates = useMemo(
    () =>
      buildSettingsSearchCandidates({
        desktopBrowserAvailable,
        hosts,
        projects,
        sections: sections.length > 0 ? sections : SETTINGS_NAV_SECTIONS,
      }),
    [desktopBrowserAvailable, hosts, projects, sections],
  );

  return useMemo(
    () => rankSettingsSearchCandidates({ candidates, query }),
    [candidates, query],
  );
}
