export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "providers", label: "Providers" },
  { id: "appearance", label: "Appearance" },
  { id: "keyboard", label: "Keyboard" },
  { id: "browser", label: "Browser" },
  { id: "usage", label: "Usage limits" },
  { id: "files", label: "Files" },
  { id: "projects", label: "Projects" },
  { id: "machines", label: "Machines" },
  { id: "updates", label: "Updates" },
  { id: "plugins", label: "Installed plugins" },
  { id: "marketplaces", label: "Plugin marketplaces" },
  { id: "experiments", label: "Experiments" },
  { id: "community", label: "Community" },
  { id: "archived", label: "Archived threads" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type SettingsSectionId = SettingsSection["id"];

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function settingsSectionLabel(sectionId: SettingsSectionId): string {
  return (
    SETTINGS_SECTIONS.find((section) => section.id === sectionId)?.label ??
    sectionId
  );
}

export type SettingsCatalogRequirement = "desktopBrowser";

export interface SettingsCatalogEntry {
  id: string;
  label: string;
  keywords: readonly string[];
  requirement?: SettingsCatalogRequirement;
  sectionId: SettingsSectionId;
}

export const SETTINGS_CATALOG = [
  {
    id: "navigate-to-threads-on-creation",
    label: "Navigate to threads on creation",
    keywords: ["open thread", "jump", "new thread", "focus"],
    sectionId: "general",
  },
  {
    id: "markdown-formatting-in-prompt-box",
    label: "Markdown formatting in prompt box",
    keywords: ["rich text", "editor", "composer", "wysiwyg"],
    sectionId: "general",
  },
  {
    id: "default-thread-followup-behavior",
    label: "Default thread followup behavior",
    keywords: ["enter key", "steer", "queue", "follow up"],
    sectionId: "general",
  },
  {
    id: "open-links-in-app-browser",
    label: "Open links in the in-app browser",
    keywords: ["external links", "desktop", "web links"],
    requirement: "desktopBrowser",
    sectionId: "general",
  },
  {
    id: "rewrite-localhost-links",
    label: "Rewrite localhost links",
    keywords: ["dev server", "port", "127.0.0.1"],
    sectionId: "general",
  },
  {
    id: "new-branch-prefix",
    label: "New branch prefix",
    keywords: ["git", "worktree", "managed branch", "naming"],
    sectionId: "general",
  },
  {
    id: "streamer-mode",
    label: "Streamer mode",
    keywords: ["screen share", "privacy", "hide models", "recording"],
    sectionId: "general",
  },
  {
    id: "bb-cli-skills",
    label: "bb CLI skills",
    keywords: ["agent skills", "install skills", "cli"],
    sectionId: "general",
  },
  {
    id: "microphone",
    label: "Microphone",
    keywords: ["voice", "dictation", "speech", "input device"],
    sectionId: "general",
  },
  {
    id: "show-diagnostic-events",
    label: "Show diagnostic events",
    keywords: ["debug", "troubleshooting", "provider events", "logs"],
    sectionId: "general",
  },
  {
    id: "sidebar-thread-list",
    label: "Sidebar",
    keywords: ["thread list", "projects list"],
    sectionId: "appearance",
  },
  {
    id: "sidebar-navigation",
    label: "Navigation",
    keywords: ["destinations", "sidebar links"],
    sectionId: "appearance",
  },
  {
    id: "source-code-renderer",
    label: "Source code",
    keywords: ["syntax highlighting", "code viewer", "renderer"],
    sectionId: "appearance",
  },
  {
    id: "diff-renderer",
    label: "Diffs",
    keywords: ["diff viewer", "split diff", "unified diff", "renderer"],
    sectionId: "appearance",
  },
  {
    id: "theme",
    label: "Theme",
    keywords: ["dark mode", "light mode", "system", "night"],
    sectionId: "appearance",
  },
  {
    id: "palette",
    label: "Palette",
    keywords: ["colors", "custom theme", "accent"],
    sectionId: "appearance",
  },
  {
    id: "favicon-color",
    label: "Favicon color",
    keywords: ["tab icon", "browser icon", "window icon"],
    sectionId: "appearance",
  },
  {
    id: "fade-inactive-splits",
    label: "Fade inactive splits",
    keywords: ["dimming", "split panes", "focus"],
    sectionId: "appearance",
  },
  {
    id: "sidebar-footer",
    label: "Sidebar footer",
    keywords: ["footer", "bottom of sidebar"],
    sectionId: "appearance",
  },
  {
    id: "show-keyboard-hints",
    label: "Show keyboard hints when holding CMD / Control",
    keywords: ["shortcuts", "badges", "hints", "command key"],
    sectionId: "keyboard",
  },
  {
    id: "local-editor-integration",
    label: "Local editor integration",
    keywords: ["open in editor", "host daemon", "vscode", "reveal"],
    sectionId: "files",
  },
  {
    id: "file-openers",
    label: "File openers",
    keywords: ["extensions", "default app", "preview"],
    sectionId: "files",
  },
  {
    id: "directory-default",
    label: "Directory default",
    keywords: ["open folder", "reveal", "finder", "explorer"],
    sectionId: "files",
  },
  {
    id: "file-default",
    label: "File default",
    keywords: ["open file", "editor", "default app"],
    sectionId: "files",
  },
  {
    id: "machine-access",
    label: "Machine access",
    keywords: ["remote access", "connection method", "bb connect"],
    sectionId: "machines",
  },
  {
    id: "machine-environment",
    label: "Machine environment",
    keywords: ["environment variables", "env", "gh token", "secrets"],
    sectionId: "machines",
  },
  {
    id: "experiment-changelog-preview",
    label: "Changelog preview",
    keywords: ["release notes", "updates page"],
    sectionId: "experiments",
  },
  {
    id: "experiment-mobile-app",
    label: "Mobile app",
    keywords: ["phone", "bb connect", "pairing", "machine code"],
    sectionId: "experiments",
  },
  {
    id: "experiment-sidebar-progressive-disclosure",
    label: "Sidebar progressive disclosure",
    keywords: ["show more", "groups", "collapse"],
    sectionId: "experiments",
  },
  {
    id: "experiment-timeline-windowing",
    label: "Timeline windowing",
    keywords: ["virtualization", "long timelines", "performance"],
    sectionId: "experiments",
  },
  {
    id: "providers-order",
    label: "Providers",
    keywords: ["default agent", "agent order", "model picker"],
    sectionId: "providers",
  },
  {
    id: "usage-limits",
    label: "Usage limits",
    keywords: ["quota", "spend", "tokens", "rate limit"],
    sectionId: "usage",
  },
  {
    id: "browsers",
    label: "Browsers",
    keywords: ["cookies", "import", "chrome", "profile"],
    sectionId: "browser",
  },
  {
    id: "projects-list",
    label: "Projects",
    keywords: ["repositories", "checkouts", "folders"],
    sectionId: "projects",
  },
  {
    id: "machines-list",
    label: "Machines",
    keywords: ["hosts", "daemon", "remote"],
    sectionId: "machines",
  },
  {
    id: "updates",
    label: "Updates",
    keywords: ["version", "upgrade", "provider cli", "daemon"],
    sectionId: "updates",
  },
  {
    id: "installed-plugins",
    label: "Installed plugins",
    keywords: ["extensions", "enable plugin", "disable plugin"],
    sectionId: "plugins",
  },
  {
    id: "plugin-marketplaces",
    label: "Plugin marketplaces",
    keywords: ["sources", "registry", "community plugins"],
    sectionId: "marketplaces",
  },
  {
    id: "community-discord",
    label: "Discord",
    keywords: ["chat", "support", "community", "announcements"],
    sectionId: "community",
  },
  {
    id: "community-github",
    label: "GitHub",
    keywords: ["source code", "issues", "releases", "repository"],
    sectionId: "community",
  },
  {
    id: "archived-threads",
    label: "Archived threads",
    keywords: ["archive", "hidden threads", "restore"],
    sectionId: "archived",
  },
] as const satisfies readonly SettingsCatalogEntry[];

export type SettingsCatalogEntryId = (typeof SETTINGS_CATALOG)[number]["id"];

export const SETTINGS_CATALOG_ENTRIES: readonly SettingsCatalogEntry[] =
  SETTINGS_CATALOG;

export const SETTING_LABEL = Object.fromEntries(
  SETTINGS_CATALOG.map((entry) => [entry.id, entry.label]),
) as Record<SettingsCatalogEntryId, string>;

export function isSettingsCatalogEntryId(
  value: string,
): value is SettingsCatalogEntryId {
  return SETTINGS_CATALOG.some((entry) => entry.id === value);
}

export function settingsCatalogAliases(
  entry: SettingsCatalogEntry,
): readonly string[] {
  return [...entry.keywords, settingsSectionLabel(entry.sectionId)];
}
