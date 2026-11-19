import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { listAllCategories, listDepartments } from "@/modules/org/service";
import { Card, PageHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/complaints/category-icon";
import { AddIssueType, RerouteSelect } from "@/components/admin/routing-actions";

export const metadata: Metadata = { title: "Routing" };

/** The routing table: which department receives each category's complaints. */
export default async function RoutingPage() {
  const { actor } = await requirePageSession(["SUPER_ADMIN"]);
  const [categories, departments] = await Promise.all([listAllCategories(actor), listDepartments(actor)]);
  const options = departments.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <PageHeader
        title="Routing"
        description="Each category sends complaints to one department. Changes apply to new complaints only."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {categories.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start gap-4">
              <CategoryIcon code={c.code} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{c.name}</h2>
                <p className="text-sm text-muted">{c._count.complaints} complaints so far</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 rounded-[1.25rem] bg-shell p-4 sm:flex-row sm:items-center">
              <span className="text-sm font-semibold text-ink-soft">Routes to</span>
              <ArrowRight className="hidden size-4 text-muted sm:block" aria-hidden />
              <RerouteSelect categoryId={c.id} categoryName={c.name} currentDepartmentId={c.departmentId} departments={options} />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-ink">Issue types</p>
              <ul className="flex flex-wrap gap-2">
                {c.issueTypes.map((t) => (
                  <li key={t.id}>
                    <Pill className={t.isActive ? "" : "line-through opacity-60"}>{t.name}</Pill>
                  </li>
                ))}
              </ul>
              <AddIssueType categoryId={c.id} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
