"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps data fresh by invoking `callback` when the user returns to the tab
 * (focus / visibility regained) and on a periodic interval while the tab is
 * visible. The interval is skipped in the background to avoid wasted fetches.
 */
export function useAutoRefresh(callback: () => void, intervalMs = 60_000) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const run = () => cbRef.current();

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);

    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);

    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [intervalMs]);
}
