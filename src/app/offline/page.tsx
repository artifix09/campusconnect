import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

/** Precached by the service worker; shown when a page is not available offline. */
export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <span className="flex size-16 items-center justify-center rounded-full bg-surface text-brand-700" aria-hidden>
        <WifiOff className="size-8" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">You are offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-muted">
          This page has not been saved on your device yet. Pages you opened recently still work, and new complaints are
          sent automatically when you are back online.
        </p>
      </div>
      <ButtonLink href="/student">Go to my dashboard</ButtonLink>
    </main>
  );
}
