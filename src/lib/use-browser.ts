"use client";

import { useSyncExternalStore } from "react";
import { pushSupport, type PushSupport } from "@/components/notifications/push";

/*
 * Browser-only facts read with useSyncExternalStore: the server renders a
 * safe default, the client reads the real value, and React re-renders when it
 * changes. No state is copied into effects.
 */

const never = () => () => {};

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function useStandalone(): boolean {
  return useSyncExternalStore(subscribeStandalone, isStandalone, () => false);
}

export function useIsIos(): boolean {
  return useSyncExternalStore(never, () => /iphone|ipad|ipod/i.test(navigator.userAgent), () => false);
}

export function usePushSupport(): PushSupport {
  return useSyncExternalStore(never, pushSupport, () => "unsupported");
}
