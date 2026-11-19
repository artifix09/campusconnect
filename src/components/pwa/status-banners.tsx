"use client";

import { WifiOff } from "lucide-react";
import { usePwa } from "./pwa-provider";

/** Offline notice. New versions activate on their own, so no update prompt is needed. */
export function StatusBanners() {
  const { online } = usePwa();
  if (online) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6">
      <div
        role="status"
        className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-pop)]"
      >
        <WifiOff className="size-4 shrink-0" aria-hidden />
        You are offline. Saved pages still work, and new complaints will send later.
      </div>
    </div>
  );
}
