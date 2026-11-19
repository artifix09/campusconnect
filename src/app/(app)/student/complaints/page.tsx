import type { Metadata } from "next";
import { ClipboardList, Plus } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { parseSearchParams } from "@/lib/search-params";
import { listComplaints } from "@/modules/complaints/service";
import { ListComplaintsQuery } from "@/modules/complaints/schemas";
import { listCategories } from "@/modules/org/service";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ComplaintCard } from "@/components/complaints/complaint-card";
import { ComplaintFilters } from "@/components/complaints/filters";
import { LoadMore } from "@/components/complaints/load-more";
import { OutboxList } from "@/components/complaints/outbox-list";

export const metadata: Metadata = { title: "My complaints" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MyComplaintsPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor } = await requirePageSession(["STUDENT"]);
  const raw = await searchParams;
  const query = parseSearchParams(ListComplaintsQuery, raw);
  const [{ data, nextCursor }, categories] = await Promise.all([listComplaints(actor, query), listCategories()]);
  const filtered = Object.keys(raw).some((k) => k !== "cursor");

  return (
    <>
      <PageHeader
        title="My complaints"
        description="Everything you have reported, and where each one stands."
        actions={
          <ButtonLink href="/student/complaints/new" icon={<Plus className="size-5" aria-hidden />}>
            New complaint
          </ButtonLink>
        }
      />
      <OutboxList />
      <ComplaintFilters categories={categories} staff={false} />
      {data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={filtered ? "No complaints match these filters" : "You have not reported anything yet"}
          description={filtered ? "Try another status or clear the filters." : "Spotted a problem on campus? It takes under a minute to report."}
          action={filtered ? null : <ButtonLink href="/student/complaints/new">Report an issue</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((c) => (
            <li key={c.id}>
              <ComplaintCard complaint={c} href={`/student/complaints/${c.id}`} />
            </li>
          ))}
        </ul>
      )}
      <LoadMore basePath="/student/complaints" searchParams={raw} cursor={nextCursor} />
    </>
  );
}
