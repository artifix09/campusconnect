import { formatDate } from "@/lib/format";
import { STATUS_LABEL, ROLE_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ComplaintDetail } from "./types";

type Event = ComplaintDetail["timeline"][number];

function describe(e: Event): string {
  switch (e.type) {
    case "CREATED":
      return "Complaint submitted and routed to the department";
    case "STATUS_CHANGED":
      return `Status changed to ${e.toStatus ? STATUS_LABEL[e.toStatus] : "updated"}`;
    case "REOPENED":
      return "Reopened by the student";
    case "PRIORITY_CHANGED":
      return "Priority updated";
    case "REASSIGNED":
      return "Reassigned to another department";
    case "COMMENTED":
      return "New message";
    case "RATED":
      return "Resolution rated";
    case "ATTACHMENT_ADDED":
      return "Photo added";
    case "IDENTITY_REVEALED":
      return "Identity revealed to the Super Admin";
    case "ESCALATED":
      return "Escalated to the Super Admin (overdue)";
    default:
      return "Updated";
  }
}

const IMPORTANT = new Set(["CREATED", "STATUS_CHANGED", "REOPENED", "ESCALATED"]);

/** The complaint's history, newest last, as an accessible ordered list. */
export function Timeline({ events }: { events: ComplaintDetail["timeline"] }) {
  return (
    <ol className="relative flex flex-col gap-5 pl-6">
      <span className="absolute left-[0.4375rem] top-2 bottom-2 w-px bg-line-strong" aria-hidden />
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={cn(
              "absolute -left-6 top-1 size-3.5 rounded-full border-2 border-surface",
              IMPORTANT.has(e.type) ? "bg-brand-600" : "bg-line-strong",
            )}
            aria-hidden
          />
          <p className="text-sm font-semibold text-ink">{describe(e)}</p>
          <p className="text-xs text-muted">
            {e.actor ? `${e.actor.name} (${ROLE_LABEL[e.actor.role as keyof typeof ROLE_LABEL] ?? "System"})` : "System"}
            <span aria-hidden> · </span>
            <time dateTime={new Date(e.createdAt).toISOString()}>{formatDate(e.createdAt, true)}</time>
          </p>
          {e.note ? <p className="mt-1.5 rounded-xl bg-shell px-3 py-2 text-sm text-ink-soft">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
