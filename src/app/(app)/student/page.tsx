import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, MessageSquareText, Plus } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { formatRelative, greeting, STATUS_LABEL } from "@/lib/format";
import { getSummary } from "@/modules/analytics/service";
import { listComplaints } from "@/modules/complaints/service";
import { ListComplaintsQuery } from "@/modules/complaints/schemas";
import { listCategories } from "@/modules/org/service";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Gauge } from "@/components/charts/gauge";
import { ComplaintCard } from "@/components/complaints/complaint-card";
import { CategoryIcon } from "@/components/complaints/category-icon";
import { OutboxList } from "@/components/complaints/outbox-list";
import { PushPrompt } from "@/components/notifications/push-prompt";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const { actor } = await requirePageSession(["STUDENT"]);
  const [summary, recent, categories] = await Promise.all([
    getSummary(actor),
    listComplaints(actor, ListComplaintsQuery.parse({ limit: "5" })),
    listCategories(),
  ]);
  const latest = recent.data.find((c) => c.status !== "PENDING") ?? recent.data[0];
  const firstName = actor.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Report campus issues and follow them until they are fixed."
        actions={
          <>
            <ButtonLink href="/student/complaints/new" icon={<Plus className="size-5" aria-hidden />}>
              New complaint
            </ButtonLink>
            <ButtonLink href="/student/complaints" variant="outline">
              My complaints
            </ButtonLink>
          </>
        }
      />

      <OutboxList />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard featured label="Total reported" value={summary.total} href="/student/complaints" note="All your complaints" />
        <StatCard label="Resolved" value={summary.resolved} href="/student/complaints?status=RESOLVED" note={summary.avgRating ? `Your average rating ${summary.avgRating}` : "Fixed by departments"} />
        <StatCard label="In progress" value={summary.inProgress} href="/student/complaints?status=IN_PROGRESS" note="Being worked on" />
        <StatCard label="Pending" value={summary.pending} href="/student/complaints?status=PENDING" note="Waiting for a response" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent complaints"
            action={
              <Link href="/student/complaints" className="inline-flex items-center gap-1 rounded-full text-sm font-semibold text-brand-700 hover:underline focus-ring">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {recent.data.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="Nothing reported yet"
              description="When you report an issue it shows up here with its status."
              action={<ButtonLink href="/student/complaints/new">Report your first issue</ButtonLink>}
            />
          ) : (
            <ul className="-mx-2 flex flex-col">
              {recent.data.map((c) => (
                <li key={c.id}>
                  <ComplaintCard complaint={c} href={`/student/complaints/${c.id}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {latest ? (
            <Card>
              <CardHeader title="Latest update" />
              <p className="text-xl font-semibold leading-snug tracking-tight text-brand-800">{latest.title}</p>
              <p className="mt-2 text-sm text-muted">
                {STATUS_LABEL[latest.status]} · {latest.department.name} · updated {formatRelative(latest.updatedAt)}
              </p>
              <Link
                href={`/student/complaints/${latest.id}`}
                className={buttonClass({ size: "lg" }) + " mt-5 w-full"}
              >
                <MessageSquareText className="size-5" aria-hidden /> Open complaint
              </Link>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Your progress" />
            <Gauge resolved={summary.resolved} inProgress={summary.inProgress} pending={summary.pending} />
          </Card>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <Card className="min-w-0 flex-1">
          <CardHeader title="Report something quickly" description="Pick a category to start a complaint." />
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/student/complaints/new?category=${c.code}`}
                className="flex items-center gap-3 rounded-[1.25rem] border border-line p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/60 focus-ring"
              >
                <CategoryIcon code={c.code} />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.department.name}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
        <div className="lg:w-[22rem] lg:shrink-0 empty:hidden">
          <PushPrompt />
        </div>
      </div>
    </>
  );
}
