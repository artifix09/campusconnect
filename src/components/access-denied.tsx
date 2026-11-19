import { ShieldX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Shown when a signed-in user opens something outside their scope, for
 * example a Library admin pasting the link of a Lab/IT complaint. The server
 * has already refused the data and written an audit entry.
 */
export function AccessDenied({ backHref, backLabel = "Back to complaints" }: { backHref: string; backLabel?: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-rejected-soft text-rejected" aria-hidden>
        <ShieldX className="size-8" />
      </span>
      <p className="text-sm font-semibold uppercase tracking-[0.08em] text-rejected">Error 403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">You do not have access to this complaint</h1>
      <p className="mt-3 text-[0.9375rem] text-muted">
        It belongs to another department or student. This attempt has been recorded. If you think you should have
        access, contact the CampusConnect administrator.
      </p>
      <ButtonLink href={backHref} className="mt-7">
        {backLabel}
      </ButtonLink>
    </div>
  );
}
