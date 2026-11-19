import Link from "next/link";
import { ChevronRight, Paperclip, Users } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { OverdueBadge, StatusBadge } from "@/components/ui/badge";
import { CategoryIcon } from "./category-icon";
import type { ComplaintListItem } from "./types";

/** A complaint as a tappable row, used in student lists and dashboard widgets. */
export function ComplaintCard({ complaint, href }: { complaint: ComplaintListItem; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[1.25rem] bg-surface p-4 transition-colors duration-150 hover:bg-brand-50/60 focus-ring"
    >
      <CategoryIcon code={complaint.category.code} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate font-semibold text-ink">{complaint.title}</p>
          {complaint.overdue ? <OverdueBadge /> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          <span className="font-semibold text-ink-soft">{complaint.referenceNo}</span>
          <span aria-hidden> · </span>
          {complaint.department.name}
          <span aria-hidden> · </span>
          {formatRelative(complaint.createdAt)}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-xs text-muted sm:flex">
        {complaint.attachmentCount > 0 ? (
          <span className="inline-flex items-center gap-1" title="Photos attached">
            <Paperclip className="size-3.5" aria-hidden />
            {complaint.attachmentCount}
          </span>
        ) : null}
        {complaint.supportCount > 0 ? (
          <span className="inline-flex items-center gap-1" title="Students who also reported this">
            <Users className="size-3.5" aria-hidden />
            {complaint.supportCount}
          </span>
        ) : null}
      </div>
      <StatusBadge status={complaint.status} />
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
