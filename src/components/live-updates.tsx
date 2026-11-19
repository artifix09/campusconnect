"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { REFRESH_EVENT } from "@/components/pwa/pwa-provider";

const INTERVAL_MS = 8_000;

/**
 * Keeps every open page current without manual reloads. While the tab is
 * visible it asks the server for a change stamp every few seconds and, only
 * when it changed, re-renders the page's server data in place. Form input and
 * other client state are kept. Push notifications and returning to the tab
 * trigger an immediate check.
 */
export function LiveUpdates() {
  const router = useRouter();
  const stamp = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (busy.current || document.visibilityState !== "visible" || !navigator.onLine) return;
      busy.current = true;
      try {
        const response = await fetch("/api/v1/updates", { credentials: "same-origin", cache: "no-store" });
        if (response.ok) {
          const { stamp: next } = (await response.json()) as { stamp: string };
          if (stamp.current !== null && stamp.current !== next) router.refresh();
          stamp.current = next;
        }
      } catch {
        // offline or server busy: try again on the next tick
      } finally {
        busy.current = false;
      }
    }

    function loop() {
      void check();
      timer = setTimeout(loop, INTERVAL_MS);
    }

    const now = () => void check();
    loop();
    document.addEventListener("visibilitychange", now);
    window.addEventListener("focus", now);
    window.addEventListener("online", now);
    window.addEventListener(REFRESH_EVENT, now);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", now);
      window.removeEventListener("focus", now);
      window.removeEventListener("online", now);
      window.removeEventListener(REFRESH_EVENT, now);
    };
  }, [router]);

  return null;
}
