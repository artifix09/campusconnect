"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSupport } from "@/lib/use-browser";
import { enablePush } from "./push";

/**
 * Asks for notification permission in context (after the student has a reason
 * to want updates), never on first visit.
 */
export function PushPrompt() {
  const support = usePushSupport();
  const [result, setResult] = useState<"on" | "denied" | null>(null);
  const [busy, setBusy] = useState(false);
  const state =
    result ?? (support === "unsupported" ? "hidden" : support === "granted" ? "on" : support === "denied" ? "denied" : "ask");

  if (state === "hidden" || state === "on") return null;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-950 p-6 text-white">
      <svg className="pointer-events-none absolute -right-10 -bottom-10 size-56 opacity-40" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="80" stroke="#48a877" strokeWidth="18" fill="none" opacity="0.4" />
        <circle cx="100" cy="100" r="45" stroke="#2b8b5b" strokeWidth="18" fill="none" opacity="0.5" />
      </svg>
      <div className="relative">
        <BellRing className="size-7 text-brand-300" aria-hidden />
        <p className="mt-4 text-xl font-semibold leading-snug">Know the moment it is fixed</p>
        <p className="mt-2 text-sm text-brand-100">
          {state === "denied"
            ? "Notifications are blocked in your browser settings. You will still get email updates."
            : "Get a notification when a department replies or changes the status of your complaint."}
        </p>
        {state === "ask" ? (
          <Button
            variant="light"
            className="mt-5"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await enablePush();
              setBusy(false);
              setResult(ok ? "on" : "denied");
            }}
          >
            Turn on notifications
          </Button>
        ) : null}
      </div>
    </div>
  );
}
