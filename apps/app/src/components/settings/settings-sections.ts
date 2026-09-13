import type { IconName } from "@bb/shared-ui/icon";
import {
  SETTINGS_SECTIONS,
  isSettingsSectionId,
  type SettingsSectionId,
} from "@bb/client-core";
import { SETTINGS_ROUTE_PATH, getSettingsRoutePath } from "@/lib/route-paths";

const SETTINGS_SECTION_ICONS: Record<SettingsSectionId, IconName> = {
  general: "Settings",
  providers: "Bot",
  appearance: "Palette",
  keyboard: "SlidersHorizontal",
  browser: "Browser",
  usage: "ChartColumn",
  files: "File",
  projects: "FolderGit",
  machines: "Laptop",
  updates: "PackageReceive",
  plugins: "ElectricPlugs",
  marketplaces: "Puzzle",
  experiments: "Beaker",
  community: "MessageSquare",
  archived: "Archive",
};

export interface SettingsNavSection {
  icon: IconName;
  id: SettingsSectionId;
  label: string;
}

export const SETTINGS_NAV_SECTIONS: readonly SettingsNavSection[] =
  SETTINGS_SECTIONS.map((section) => ({
    icon: SETTINGS_SECTION_ICONS[section.id],
    id: section.id,
    label: section.label,
  }));

export { isSettingsSectionId };
export type { SettingsSectionId };

export function getSettingsSectionRoutePath(
  sectionId: SettingsSectionId,
): string {
  return sectionId === "general"
    ? SETTINGS_ROUTE_PATH
    : getSettingsRoutePath(sectionId);
}
