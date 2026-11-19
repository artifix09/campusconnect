import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { cn } from "@/lib/cn";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { parseSearchParams } from "@/lib/search-params";
import { listDepartments, listUsers, ListUsersQuery } from "@/modules/org/service";
import { PageHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { LoadMore } from "@/components/complaints/load-more";
import { CreateStaffButton, UserStatusButton } from "@/components/admin/user-actions";

export const metadata: Metadata = { title: "Staff & users" };

const TABS = [
  { role: "", label: "Everyone" },
  { role: "DEPT_ADMIN", label: "Department admins" },
  { role: "SUPER_ADMIN", label: "Super admins" },
  { role: "STUDENT", label: "Students" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requirePageSession(["SUPER_ADMIN"]);
  const raw = await searchParams;
  const query = parseSearchParams(ListUsersQuery, raw);
  const [{ data, nextCursor }, departments] = await Promise.all([listUsers(actor, query), listDepartments(actor)]);

  return (
    <>
      <PageHeader
        title="Staff & users"
        description="Create department admin accounts and deactivate access when staff leave."
        actions={<CreateStaffButton departments={departments.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }))} />}
      />

      <nav aria-label="Filter by role" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => {
          const active = (query.role ?? "") === t.role;
          return (
            <Link
              key={t.label}
              href={t.role ? `/admin/users?role=${t.role}` : "/admin/users"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-ring",
                active ? "bg-brand-800 text-white" : "bg-surface text-ink-soft hover:bg-brand-50",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">Users</caption>
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="px-5 py-4">Name</th>
              <th scope="col" className="px-4 py-4">Role</th>
              <th scope="col" className="px-4 py-4">Department</th>
              <th scope="col" className="px-4 py-4">Joined</th>
              <th scope="col" className="px-5 py-4 text-right">Access</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Pill>{ROLE_LABEL[u.role]}</Pill>
                    {u.twoFactorEnabled ? (
                      <ShieldCheck className="size-4 text-brand-700" aria-label="Two-step verification on" />
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-ink-soft">{u.department?.name ?? (u.registrationNo || "None")}</td>
                <td className="px-4 py-3.5 text-ink-soft">{formatDate(u.createdAt)}</td>
                <td className="px-5 py-3.5 text-right">
                  {u.id === actor.id ? (
                    <span className="text-xs text-muted">You</span>
                  ) : (
                    <UserStatusButton userId={u.id} active={u.isActive} name={u.name} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LoadMore basePath="/admin/users" searchParams={raw} cursor={nextCursor} />
    </>
  );
}
