import type { Metadata } from "next";
import { Download, Inbox } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { parseSearchParams } from "@/lib/search-params";
import { listComplaints } from "@/modules/complaints/service";
import { ListComplaintsQuery } from "@/modules/complaints/schemas";
import { listCategories, listDepartments } from "@/modules/org/service";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ComplaintTable } from "@/components/complaints/complaint-table";
import { ComplaintFilters } from "@/components/complaints/filters";
import { LoadMore } from "@/components/complaints/load-more";

export const metadata: Metadata = { title: "Complaints" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminComplaintsPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requirePageSession(["DEPT_ADMIN", "SUPER_ADMIN"]);
  const raw = await searchParams;
  const query = parseSearchParams(ListComplaintsQuery, raw);
  const isSuper = actor.role === "SUPER_ADMIN";

  const [{ data, nextCursor }, categories, departments] = await Promise.all([
    listComplaints(actor, query),
    listCategories(),
    isSuper ? listDepartments(actor) : Promise.resolve([]),
  ]);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && k !== "cursor") exportParams.set(k, v);

  return (
    <>
      <PageHeader
        title={isSuper ? "All complaints" : "Department queue"}
        description={
          isSuper
            ? "Every complaint across all departments. Filter, search and open any of them."
            : "Complaints routed to your department, current and previously handled."
        }
        actions={
          <a href={`/api/v1/complaints/export.csv?${exportParams.toString()}`} className={buttonClass({ variant: "outline" })}>
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
        }
      />
      <ComplaintFilters
        categories={isSuper ? categories : categories.filter((c) => c.department.id === (actor.role === "DEPT_ADMIN" ? actor.departmentId : ""))}
        departments={isSuper ? departments.map((d) => ({ id: d.id, name: d.name })) : undefined}
        staff
      />
      {data.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="Nothing here"
          description="No complaints match these filters. When students report something, it will appear here."
        />
      ) : (
        <ComplaintTable complaints={data} showDepartment={isSuper} />
      )}
      <LoadMore basePath="/admin/complaints" searchParams={raw} cursor={nextCursor} />
    </>
  );
}
