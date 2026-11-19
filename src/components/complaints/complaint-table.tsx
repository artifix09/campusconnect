import Link from "next/link";
import { EyeOff } from "lucide-react";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { CategoryIcon } from "./category-icon";
import type { ComplaintListItem } from "./types";

/** Staff queue. A real table on wide screens, stacked cards on phones. */
export function ComplaintTable({ complaints, showDepartment }: { complaints: ComplaintListItem[]; showDepartment: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] bg-surface md:block">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">Complaints</caption>
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="px-5 py-4">Complaint</th>
              <th scope="col" className="px-4 py-4">Student</th>
              {showDepartment ? <th scope="col" className="px-4 py-4">Department</th> : null}
              <th scope="col" className="px-4 py-4">Priority</th>
              <th scope="col" className="px-4 py-4">Status</th>
              <th scope="col" className="px-5 py-4">Due</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c) => (
              <tr key={c.id} className="group border-b border-line last:border-0 hover:bg-brand-50/50">
                <td className="max-w-[24rem] px-5 py-3.5">
                  <Link href={`/admin/complaints/${c.id}`} className="flex items-center gap-3 rounded-xl focus-ring">
                    <CategoryIcon code={c.category.code} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink group-hover:text-brand-800">{c.title}</span>
                      <span className="block text-xs text-muted">
                        {c.referenceNo} · {formatRelative(c.createdAt)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  {c.student.id ? (
                    <span className="flex items-center gap-2.5">
                      <Avatar name={c.student.name} size="sm" />
                      <span className="max-w-36 truncate text-ink-soft">{c.student.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <EyeOff className="size-4" aria-hidden /> Anonymous
                    </span>
                  )}
                </td>
                {showDepartment ? <td className="max-w-44 truncate px-4 py-3.5 text-ink-soft">{c.department.name}</td> : null}
                <td className="px-4 py-3.5">
                  <PriorityBadge priority={c.priority} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {c.overdue ? <OverdueBadge /> : <span className="text-ink-soft">{formatDate(c.dueAt)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {complaints.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/complaints/${c.id}`} className="block rounded-[1.25rem] bg-surface p-4 focus-ring">
              <div className="flex items-start gap-3">
                <CategoryIcon code={c.category.code} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{c.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {c.referenceNo} · {c.student.id ? c.student.name : "Anonymous"} · {formatRelative(c.createdAt)}
                  </p>
                </div>
              </div>
              <div className={cn("mt-3 flex flex-wrap items-center gap-2")}>
                <StatusBadge status={c.status} />
                <PriorityBadge priority={c.priority} />
                {c.overdue ? <OverdueBadge /> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
