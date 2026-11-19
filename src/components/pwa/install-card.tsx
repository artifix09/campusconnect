"use client";

import { useState } from "react";
import { Share, SquarePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LogoMark } from "@/components/ui/logo";
import { usePwa } from "./pwa-provider";

/** Sidebar promo that installs the app (Android, desktop) or explains how (iOS). */
export function InstallCard() {
  const { canInstall, install, isIos, isStandalone } = usePwa();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isStandalone || (!canInstall && !isIos)) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-950 p-5 text-white">
        <svg className="pointer-events-none absolute inset-0 size-full opacity-40" viewBox="0 0 200 200" aria-hidden>
          <path d="M-20 160 C 60 120, 90 40, 220 20" stroke="#48a877" strokeWidth="18" fill="none" opacity="0.35" />
          <path d="M-20 200 C 80 150, 120 90, 220 80" stroke="#2b8b5b" strokeWidth="26" fill="none" opacity="0.35" />
        </svg>
        <div className="relative">
          <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-white/15">
            <LogoMark inverted className="size-6" />
          </span>
          <p className="text-lg font-semibold leading-snug">Get the CampusConnect app</p>
          <p className="mt-1 text-xs text-brand-100">Report issues in seconds, even offline.</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4 w-full"
            icon={<Smartphone className="size-4" aria-hidden />}
            onClick={() => (canInstall ? void install() : setShowIosHelp(true))}
          >
            Install app
          </Button>
        </div>
      </div>

      <Dialog
        open={showIosHelp}
        onClose={() => setShowIosHelp(false)}
        title="Install on iPhone or iPad"
        description="Safari installs web apps from the Share menu."
      >
        <ol className="flex flex-col gap-3 text-sm text-ink-soft">
          <li className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
              <Share className="size-4" aria-hidden />
            </span>
            Tap the Share button in Safari&apos;s toolbar.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
              <SquarePlus className="size-4" aria-hidden />
            </span>
            Choose &quot;Add to Home Screen&quot;, then tap Add.
          </li>
        </ol>
        <p className="mt-4 rounded-2xl bg-shell p-3 text-xs text-muted">
          Once installed, open CampusConnect from your home screen to receive notifications.
        </p>
      </Dialog>
    </>
  );
}
