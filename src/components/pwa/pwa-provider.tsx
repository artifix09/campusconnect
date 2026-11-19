"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { flushOutbox } from "@/lib/offline-queue";

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type PwaState = {
  canInstall: boolean;
  isStandalone: boolean;
  isIos: boolean;
  install: () => Promise<void>;
  updateReady: boolean;
  applyUpdate: () => void;
  online: boolean;
};

const PwaContext = createContext<PwaState | null>(null);

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

/**
 * Registers the service worker, keeps the install prompt for our own
 * "Install app" button, offers updates without forcing a reload mid-form,
 * and sends queued offline complaints when the connection returns.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [isStandalone, setStandalone] = useState(false);
  const [isIos, setIos] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setOnline(navigator.onLine);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setPrompt(null);
      setStandalone(true);
    };
    const onOnline = () => {
      setOnline(true);
      void flushOutbox();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      });
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "FLUSH_OUTBOX") void flushOutbox();
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    }

    void flushOutbox();

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }, [prompt]);

  const applyUpdate = useCallback(() => waiting?.postMessage({ type: "SKIP_WAITING" }), [waiting]);

  return (
    <PwaContext.Provider
      value={{ canInstall: Boolean(prompt), isStandalone, isIos, install, updateReady: Boolean(waiting), applyUpdate, online }}
    >
      {children}
    </PwaContext.Provider>
  );
}
