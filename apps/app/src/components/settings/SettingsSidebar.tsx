import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { Input } from "@bb/shared-ui/input";
import { cn } from "@bb/shared-ui/lib/utils";
import { PluginIcon } from "@/components/plugin/PluginIcon";
import {
  SectionSidebar,
  SectionSidebarIcon,
  SectionSidebarLabel,
  SectionSidebarActionRow,
  SectionSidebarRow,
} from "@/components/sidebar/SectionSidebar";
import { useCloseMobileSidebar } from "@/components/ui/sidebar.js";
import { canOpenNativeScreen, shellOpenNative } from "@/lib/native-shell";
import { getPluginConfigurationRoutePath } from "@/lib/route-paths";
import { useSettingsNavState } from "./settings-nav";
import type { SettingsNavState } from "./settings-nav";
import { getSettingsSectionRoutePath } from "./settings-sections";
import { useSettingsSearchResults } from "./settings-search";
import type {
  SettingsSearchNamedEntity,
  SettingsSearchResult,
} from "./settings-search";

interface SettingsSidebarProps {
  onResizeMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  isResizing: boolean;
  appRoutePath: string;
  mobileHosted?: boolean;
}

type SettingsSidebarNavigation = Pick<
  SettingsNavState,
  "activePluginId" | "activeSection" | "pluginEntries" | "sections"
> &
  Partial<Pick<SettingsNavState, "searchHosts" | "searchProjects">>;

interface SettingsSidebarContentProps extends SettingsSidebarProps {
  navigation: SettingsSidebarNavigation;
  testIdPrefix?: string;
}

const EMPTY_ENTITIES: readonly SettingsSearchNamedEntity[] = [];

interface LabelSegment {
  text: string;
  emphasized: boolean;
}

export function labelSegments(
  label: string,
  positions: readonly number[],
): LabelSegment[] {
  const emphasized = new Set(positions);
  const segments: LabelSegment[] = [];
  for (const [index, character] of [...label].entries()) {
    const isEmphasized = emphasized.has(index);
    const previous = segments.at(-1);
    if (previous !== undefined && previous.emphasized === isEmphasized) {
      previous.text += character;
      continue;
    }
    segments.push({ text: character, emphasized: isEmphasized });
  }
  return segments;
}

function HighlightedLabel({
  label,
  positions,
}: {
  label: string;
  positions: readonly number[];
}) {
  return (
    <span className="min-w-0 truncate">
      {labelSegments(label, positions).map((segment, index) => (
        <span
          key={`${index}-${segment.text}`}
          className={segment.emphasized ? "text-foreground underline" : ""}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}

function SettingsSearchResults({
  activeIndex,
  results,
  testIdPrefix,
}: {
  activeIndex: number;
  results: readonly SettingsSearchResult[];
  testIdPrefix: string;
}) {
  const closeOnMobile = useCloseMobileSidebar();
  const navigate = useNavigate();

  if (results.length === 0) {
    return (
      <p
        className="px-2 py-3 text-xs text-subtle-foreground"
        data-testid={`${testIdPrefix}-search-empty`}
      >
        No settings match.
      </p>
    );
  }

  return (
    <div
      className="mt-1 space-y-0.5"
      data-testid={`${testIdPrefix}-search-results`}
      role="listbox"
    >
      {results.map((result, index) => (
        <button
          key={result.candidate.id}
          type="button"
          role="option"
          aria-label={result.candidate.label}
          aria-selected={index === activeIndex}
          data-active={index === activeIndex ? "true" : undefined}
          className={cn(
            "flex w-full min-w-0 flex-col items-start gap-0 rounded-md px-2 py-1.5 text-left",
            index === activeIndex && "bg-sidebar-accent",
          )}
          onClick={() => {
            closeOnMobile();
            navigate(result.candidate.to);
          }}
        >
          <HighlightedLabel
            label={result.candidate.label}
            positions={result.positions}
          />
          <span className="text-2xs text-subtle-foreground">
            {result.candidate.sectionLabel}
          </span>
        </button>
      ))}
    </div>
  );
}

export function SettingsSidebarContent({
  onResizeMouseDown,
  isResizing,
  appRoutePath,
  mobileHosted,
  navigation,
  testIdPrefix = "settings",
}: SettingsSidebarContentProps) {
  const { activePluginId, activeSection, pluginEntries, sections } = navigation;
  const hasPlugins = pluginEntries.length > 0;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const closeOnMobile = useCloseMobileSidebar();
  const results = useSettingsSearchResults({
    hosts: navigation.searchHosts ?? EMPTY_ENTITIES,
    projects: navigation.searchProjects ?? EMPTY_ENTITIES,
    query,
    sections,
  });
  const searching = query.trim() !== "";
  const boundedActiveIndex = useMemo(
    () => (activeIndex < results.length ? activeIndex : 0),
    [activeIndex, results.length],
  );

  useEffect(() => {
    if (expanded) {
      searchInputRef.current?.focus();
    }
  }, [expanded]);

  const collapseSearch = () => {
    setExpanded(false);
    setQuery("");
    setActiveIndex(0);
  };

  return (
    <SectionSidebar
      backLabel="Back to app"
      backTo={appRoutePath}
      isResizing={isResizing}
      mobileHosted={mobileHosted}
      onResizeMouseDown={onResizeMouseDown}
      testIdPrefix={testIdPrefix}
    >
      {expanded ? (
        <div className="px-2 pb-1">
          <Input
            ref={searchInputRef}
            aria-label="Search settings"
            placeholder="Search settings"
            value={query}
            data-testid={`${testIdPrefix}-search-input`}
            onBlur={() => {
              if (query.trim() === "") {
                setExpanded(false);
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                collapseSearch();
                return;
              }
              if (!searching) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  results.length === 0 ? 0 : (current + 1) % results.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) =>
                  results.length === 0
                    ? 0
                    : (current - 1 + results.length) % results.length,
                );
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const selected = results[boundedActiveIndex];
                if (selected === undefined) return;
                closeOnMobile();
                navigate(selected.candidate.to);
              }
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1 pr-1">
          <SectionSidebarLabel>Settings</SectionSidebarLabel>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Search settings"
            data-testid={`${testIdPrefix}-search-toggle`}
            onClick={() => setExpanded(true)}
          >
            <Icon name="Search" aria-hidden />
          </Button>
        </div>
      )}
      {searching ? (
        <SettingsSearchResults
          activeIndex={boundedActiveIndex}
          results={results}
          testIdPrefix={testIdPrefix}
        />
      ) : (
        <>
          <div className="mt-1 space-y-0.5">
            {sections
              .filter((section) => section.id !== "archived")
              .map((section) => (
                <SectionSidebarRow
                  key={section.id}
                  active={activeSection === section.id}
                  label={section.label}
                  to={getSettingsSectionRoutePath(section.id)}
                >
                  <SectionSidebarIcon name={section.icon} />
                </SectionSidebarRow>
              ))}
          </div>
          {hasPlugins ? (
            <>
              <div className="mt-4">
                <SectionSidebarLabel>Plugins</SectionSidebarLabel>
              </div>
              <div className="mt-1 space-y-0.5">
                {pluginEntries.map((entry) => (
                  <SectionSidebarRow
                    key={entry.id}
                    active={activePluginId === entry.id}
                    label={entry.label}
                    to={getPluginConfigurationRoutePath({ pluginId: entry.id })}
                  >
                    <PluginIcon
                      pluginId={entry.id}
                      icon={entry.icon}
                      className="size-4 shrink-0"
                    />
                  </SectionSidebarRow>
                ))}
              </div>
            </>
          ) : null}
          {canOpenNativeScreen() ? (
            <>
              <div className="mt-4">
                <SectionSidebarLabel>This phone</SectionSidebarLabel>
              </div>
              <div className="mt-1 space-y-0.5">
                <SectionSidebarActionRow
                  label="This device"
                  testId="settings-nav-native-device"
                  onClick={() => shellOpenNative("device-settings")}
                >
                  <SectionSidebarIcon name="Smartphone" />
                </SectionSidebarActionRow>
              </div>
            </>
          ) : null}
          {sections.some((section) => section.id === "archived") ? (
            <>
              <div className="mt-4">
                <SectionSidebarLabel>Archived</SectionSidebarLabel>
              </div>
              <div className="mt-1 space-y-0.5">
                {sections
                  .filter((section) => section.id === "archived")
                  .map((section) => (
                    <SectionSidebarRow
                      key={section.id}
                      active={activeSection === section.id}
                      label={section.label}
                      to={getSettingsSectionRoutePath(section.id)}
                    >
                      <SectionSidebarIcon name={section.icon} />
                    </SectionSidebarRow>
                  ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </SectionSidebar>
  );
}

export function SettingsSidebar({
  onResizeMouseDown,
  isResizing,
  appRoutePath,
  mobileHosted,
}: SettingsSidebarProps) {
  const navigation = useSettingsNavState();

  return (
    <SettingsSidebarContent
      appRoutePath={appRoutePath}
      isResizing={isResizing}
      mobileHosted={mobileHosted}
      navigation={navigation}
      onResizeMouseDown={onResizeMouseDown}
    />
  );
}
