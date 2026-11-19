import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/lib/page-session";
import { cn } from "@/lib/cn";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { parseSearchParams } from "@/lib/search-params";
import { AuditQuery, listAuditLog } from "@/modules/org/service";
import { PageHeader } from "@/components/ui/card";
import { LoadMore } from "@/components/complaints/load-more";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requirePageSession(["SUPER_ADMIN"]);
  const raw = await searchParams;
  const query = parseSearchParams(AuditQuery, raw);
  const { data, nextCursor } = await listAuditLog(actor, query);

  const tabs = [
    { key: "", label: "All events" },
    { key: "DENIED", label: "Denied access" },
    { key: "ALLOWED", label: "Admin actions" },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sensitive actions and every refused access attempt, with who, when and from where."
      />
      <nav aria-label="Filter by outcome" className="mb-5 flex gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const active = (query.outcome ?? "") === t.key;
          return (
            <Link
              key={t.label}
              href={t.key ? `/admin/audit?outcome=${t.key}` : "/admin/audit"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold focus-ring",
                active ? "bg-brand-800 text-white" : "bg-surface text-ink-soft hover:bg-brand-50",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-[var(--radius-card)] bg-surface">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">Audit log</caption>
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="px-5 py-4">When</th>
              <th scope="col" className="px-4 py-4">Who</th>
              <th scope="col" className="px-4 py-4">Action</th>
              <th scope="col" className="px-4 py-4">Outcome</th>
              <th scope="col" className="px-5 py-4">IP address</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted">No events recorded.</td>
              </tr>
            ) : (
              data.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap text-ink-soft">{formatDate(e.createdAt, true)}</td>
                  <td className="px-4 py-3">
                    {e.actor ? (
                      <>
                        <span className="block font-medium text-ink">{e.actor.name}</span>
                        <span className="block text-xs text-muted">{ROLE_LABEL[e.actor.role]}</span>
                      </>
                    ) : (
                      <span className="text-muted">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded-md bg-shell px-1.5 py-0.5 text-xs text-ink">{e.action}</code>
                    {e.entityId ? <span className="ml-2 text-xs text-muted">{e.entityType}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        e.outcome === "DENIED" ? "bg-rejected-soft text-rejected" : "bg-resolved-soft text-resolved",
                      )}
                    >
                      {e.outcome === "DENIED" ? "Denied" : "Allowed"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{e.ip ?? "Unknown"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <LoadMore basePath="/admin/audit" searchParams={raw} cursor={nextCursor} />
    </>
  );
}
