import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const HIGHLIGHT_DURATION_MS = 2000;
const OBSERVE_TIMEOUT_MS = 5000;

export function useSettingHighlight(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedSettingId = new URLSearchParams(location.search).get(
    "setting",
  );
  const [highlightedSettingId, setHighlightedSettingId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (requestedSettingId === null) {
      setHighlightedSettingId(null);
      return;
    }

    let highlightTimer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const reveal = (target: Element) => {
      settled = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedSettingId(requestedSettingId);
      highlightTimer = setTimeout(() => {
        setHighlightedSettingId(null);
      }, HIGHLIGHT_DURATION_MS);
    };

    const selector = `[data-setting-id="${CSS.escape(requestedSettingId)}"]`;
    const existing = document.querySelector(selector);
    const observer = new MutationObserver(() => {
      const target = document.querySelector(selector);
      if (target !== null) {
        observer.disconnect();
        reveal(target);
      }
    });

    if (existing !== null) {
      reveal(existing);
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    const observeTimer = setTimeout(() => {
      observer.disconnect();
    }, OBSERVE_TIMEOUT_MS);

    const nextSearch = new URLSearchParams(location.search);
    nextSearch.delete("setting");
    const nextQuery = nextSearch.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextQuery === "" ? "" : `?${nextQuery}`,
        hash: location.hash,
      },
      { replace: true },
    );

    return () => {
      observer.disconnect();
      clearTimeout(observeTimer);
      if (highlightTimer !== undefined) {
        clearTimeout(highlightTimer);
      }
      if (!settled) {
        setHighlightedSettingId(null);
      }
    };
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    requestedSettingId,
  ]);

  return highlightedSettingId;
}
