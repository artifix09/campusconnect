"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { flushOutbox } from "@/lib/offline-queue";
import { useIsIos, useOnline, useStandalone } from "@/lib/use-browser";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type PwaState = {
  canInstall: boolean;
  isStandalone: boolean;
  isIos: boolean;
  install: () => Promise<void>;
  online: boolean;
};

const PwaContext = createContext<PwaState | null>(null);

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

/** Event other components listen to when the server says data changed. */
export const REFRESH_EVENT = "cc-refresh";

function isTyping() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/**
 * Registers the service worker and keeps it current, keeps the install prompt
 * for our own "Install app" button, and sends queued offline complaints when
 * the connection returns.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const isStandalone = useStandalone();
  const isIos = useIsIos();
  const online = useOnline();

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    const onOnline = () => void flushOutbox();

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update().catch(() => undefined);
    };

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const hadController = Boolean(navigator.serviceWorker.controller);
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((r) => (registration = r))
        .catch(() => undefined);

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "FLUSH_OUTBOX") void flushOutbox();
        if (event.data?.type === "REFRESH") window.dispatchEvent(new Event(REFRESH_EVENT));
      });

      // A new version took over: reload once so the page and its assets match,
      // unless the user is typing (the next navigation picks up the new version).
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController && !isTyping()) window.location.reload();
      });
      document.addEventListener("visibilitychange", checkForUpdate);
    }

    void flushOutbox();

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }, [prompt]);

  return (
    <PwaContext.Provider value={{ canInstall: Boolean(prompt), isStandalone, isIos, install, online }}>
      {children}
    </PwaContext.Provider>
  );
}
