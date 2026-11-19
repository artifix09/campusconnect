"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { usePwa } from "./pwa-provider";

/** Offline notice and the "new version available" prompt. */
export function StatusBanners() {
  const { online, updateReady, applyUpdate } = usePwa();
  if (online && !updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6">
      {!online ? (
        <div role="status" className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pop)]">
          <WifiOff className="size-4" aria-hidden />
          You are offline. Saved pages still work, and new complaints will send later.
        </div>
      ) : (
        <div role="status" className="flex items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-sm font-medium text-white shadow-[var(--shadow-pop)]">
          A new version of CampusConnect is ready.
          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-brand-900 hover:bg-brand-50"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
