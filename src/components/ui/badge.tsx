import type { ReactNode } from "react";
import { TriangleAlert, ArrowDown, ArrowUp, Flame, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { ComplaintStatus, Priority } from "@/domain/types";

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  PENDING: "bg-pending-soft text-pending border-pending/25",
  IN_PROGRESS: "bg-progress-soft text-progress border-progress/25",
  RESOLVED: "bg-resolved-soft text-resolved border-resolved/25",
  REJECTED: "bg-rejected-soft text-rejected border-rejected/25",
  WITHDRAWN: "bg-withdrawn-soft text-withdrawn border-withdrawn/25",
};

const STATUS_DOT: Record<ComplaintStatus, string> = {
  PENDING: "bg-pending",
  IN_PROGRESS: "bg-progress",
  RESOLVED: "bg-resolved",
  REJECTED: "bg-rejected",
  WITHDRAWN: "bg-withdrawn",
};

export function StatusBadge({ status, className }: { status: ComplaintStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_STYLE[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_ICON: Record<Priority, ReactNode> = {
  LOW: <ArrowDown className="size-3.5" aria-hidden />,
  MEDIUM: <Minus className="size-3.5" aria-hidden />,
  HIGH: <ArrowUp className="size-3.5" aria-hidden />,
  URGENT: <Flame className="size-3.5" aria-hidden />,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone =
    priority === "URGENT"
      ? "text-rejected"
      : priority === "HIGH"
        ? "text-pending"
        : priority === "LOW"
          ? "text-muted"
          : "text-ink-soft";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap", tone)}>
      {PRIORITY_ICON[priority]}
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rejected-soft px-2 py-0.5 text-xs font-semibold text-rejected">
      <TriangleAlert className="size-3.5" aria-hidden />
      Overdue
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-shell px-2.5 py-0.5 text-xs font-medium text-ink-soft whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
