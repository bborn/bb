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
      return;
    }

    const findRow = () =>
      [...document.querySelectorAll("[data-setting-id]")].find(
        (row) => row.getAttribute("data-setting-id") === requestedSettingId,
      ) ?? null;

    const clearSettingParam = () => {
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
    };

    const reveal = (target: Element) => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedSettingId(requestedSettingId);
      clearSettingParam();
    };

    const existing = findRow();
    if (existing !== null) {
      reveal(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const target = findRow();
      if (target !== null) {
        observer.disconnect();
        reveal(target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const observeTimer = setTimeout(() => {
      observer.disconnect();
    }, OBSERVE_TIMEOUT_MS);

    return () => {
      observer.disconnect();
      clearTimeout(observeTimer);
    };
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    requestedSettingId,
  ]);

  useEffect(() => {
    if (highlightedSettingId === null) {
      return;
    }
    const highlightTimer = setTimeout(() => {
      setHighlightedSettingId(null);
    }, HIGHLIGHT_DURATION_MS);
    return () => {
      clearTimeout(highlightTimer);
    };
  }, [highlightedSettingId]);

  return highlightedSettingId;
}
