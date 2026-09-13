import { createContext, useContext } from "react";

export const SettingsHighlightContext = createContext<string | null>(null);

export function useHighlightedSettingId(): string | null {
  return useContext(SettingsHighlightContext);
}
