import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ClipboardList, Download, Inbox } from "lucide-react";
import { requirePageSession } from "@/lib/page-session";
import { formatDate, formatRelative, formatShortDate } from "@/lib/format";
import { toWeek } from "@/lib/week";
import { getByDepartment, getSummary, getTopIssues, getTrend } from "@/modules/analytics/service";
import { listComplaints } from "@/modules/complaints/service";
import { ListComplaintsQuery } from "@/modules/complaints/schemas";
import { getProfile } from "@/modules/account/service";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard, NoteChip } from "@/components/dashboard/stat-card";
import { SlaCard } from "@/components/dashboard/sla-card";
import { PillBars } from "@/components/charts/pill-bars";
import { Gauge } from "@/components/charts/gauge";
import { DepartmentBars } from "@/components/charts/department-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryIcon } from "@/components/complaints/category-icon";

export const metadata: Metadata = { title: "Dashboard" };

const SHORT: Record<string, string> = {
  CAFETERIA: "Cafeteria",
  LIBRARY: "Library",
  LAB_IT: "Labs & IT",
  ACADEMIC: "Academic",
};

export default async function AdminDashboard() {
  const session = await requirePageSession(["DEPT_ADMIN", "SUPER_ADMIN"]);
  const { actor } = session;
  const isSuper = actor.role === "SUPER_ADMIN";

  const [profile, summary, daily, weekly, topIssues, recent, overdueList, byDepartment] = await Promise.all([
    getProfile(session),
    getSummary(actor),
    getTrend(actor, { interval: "day", periods: 7 }),
    isSuper ? Promise.resolve([]) : getTrend(actor, { interval: "week", periods: 12 }),
    getTopIssues(actor, { limit: 5 }),
    listComplaints(actor, ListComplaintsQuery.parse({ limit: "4" })),
    listComplaints(actor, ListComplaintsQuery.parse({ overdue: "true", sort: "dueAt", limit: "1" })),
    isSuper ? getByDepartment(actor) : Promise.resolve([]),
  ]);

  const week = toWeek(daily);
  const thisWeek = week.reduce((sum, d) => sum + (d.upcoming ? 0 : d.value), 0);
  const urgent = overdueList.data[0] ?? recent.data.find((c) => c.status === "PENDING");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          isSuper
            ? "Monitor complaints across every department and spot recurring problems."
            : `Plan, prioritise and resolve issues for ${profile.department?.name ?? "your department"}.`
        }
        actions={
          <>
            <ButtonLink href="/admin/complaints?status=PENDING" icon={<Inbox className="size-5" aria-hidden />}>
              Open queue
            </ButtonLink>
            <a href="/api/v1/complaints/export.csv" className={buttonClass({ variant: "outline" })}>
              <Download className="size-4" aria-hidden /> Export data
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          featured
          label="Total complaints"
          value={summary.total}
          href="/admin/complaints"
          note={
            <>
              <NoteChip featured>{thisWeek}</NoteChip> received this week
            </>
          }
        />
        <StatCard
          label="Resolved"
          value={summary.resolved}
          href="/admin/complaints?status=RESOLVED"
          note={summary.slaCompliance === null ? "None resolved yet" : `${summary.slaCompliance}% within deadline`}
        />
        <StatCard label="In progress" value={summary.inProgress} href="/admin/complaints?status=IN_PROGRESS" note="Being worked on" />
        <StatCard
          label="Pending"
          value={summary.pending}
          href="/admin/complaints?status=PENDING"
          note={summary.overdue ? <span className="font-semibold text-rejected">{summary.overdue} overdue</span> : "Nothing overdue"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Complaints this week" description={`${thisWeek} received so far`} />
          <PillBars data={week} caption="Complaints received per day this week" />
        </Card>

        <Card className="flex flex-col xl:col-span-4">
          <CardHeader title="Needs attention" />
          {urgent ? (
            <>
              <p className="text-2xl font-semibold leading-tight tracking-tight text-brand-800">{urgent.title}</p>
              <p className="mt-2 text-sm text-muted">
                {urgent.referenceNo} · {urgent.overdue ? `was due ${formatDate(urgent.dueAt)}` : `received ${formatRelative(urgent.createdAt)}`}
              </p>
              <div className="mt-3">
                <StatusBadge status={urgent.status} />
              </div>
              <Link href={`/admin/complaints/${urgent.id}`} className={buttonClass({ size: "lg" }) + " mt-auto w-full"}>
                <ClipboardList className="size-5" aria-hidden /> Review complaint
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">Nothing is waiting. Well done.</p>
          )}
        </Card>

        <Card className="lg:row-span-2 xl:col-span-3">
          <CardHeader
            title="Most reported"
            action={
              <Link
                href="/admin/analytics"
                aria-label="Open analytics"
                className="flex size-9 items-center justify-center rounded-full border border-line-strong text-ink transition-transform duration-200 hover:rotate-45 focus-ring"
              >
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {topIssues.length === 0 ? (
            <p className="text-sm text-muted">No complaints yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {topIssues.map((issue) => (
                <li key={`${issue.category}-${issue.issueType}`} className="flex items-center gap-3">
                  <CategoryIcon code={issue.categoryCode} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-ink">{issue.issueType}</p>
                    <p className="text-xs text-muted">
                      {issue.total} reports · {issue.open} open
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader
            title="Recent complaints"
            action={
              <Link href="/admin/complaints" className="inline-flex items-center gap-1 rounded-full text-sm font-semibold text-brand-700 hover:underline focus-ring">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {recent.data.length === 0 ? (
            <EmptyState title="No complaints yet" description="New complaints routed to you will appear here." />
          ) : (
            <ul className="flex flex-col gap-4">
              {recent.data.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/complaints/${c.id}`} className="flex items-center gap-3 rounded-2xl focus-ring">
                    <Avatar name={c.student.id ? c.student.name : "Anonymous"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{c.student.id ? c.student.name : "Anonymous student"}</p>
                      <p className="truncate text-xs text-muted">
                        Reported <span className="font-semibold text-ink-soft">{c.title}</span>
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Resolution progress" />
          <Gauge resolved={summary.resolved} inProgress={summary.inProgress} pending={summary.pending} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-12">
        {isSuper ? (
          <Card className="lg:col-span-2 xl:col-span-9">
            <CardHeader title="Complaints by department" description="How many complaints each office has received, by status." />
            <DepartmentBars
              data={byDepartment.map((d) => ({
                name: d.department.name,
                short: SHORT[d.department.code] ?? d.department.code,
                resolved: d.resolved,
                inProgress: d.inProgress,
                pending: d.pending,
                rejected: d.rejected,
                total: d.total,
              }))}
            />
          </Card>
        ) : (
          <Card className="lg:col-span-2 xl:col-span-8">
            <CardHeader title="Last 12 weeks" description="Complaints received and resolved each week." />
            <TrendChart
              data={weekly.map((w) => ({
                label: formatShortDate(w.period),
                created: w.created,
                resolved: w.resolved,
              }))}
            />
          </Card>
        )}
        <div className={isSuper ? "xl:col-span-3" : "xl:col-span-4"}>
          <SlaCard
            firstResponseHours={summary.avgFirstResponseHours}
            slaCompliance={summary.slaCompliance}
            overdue={summary.overdue}
            href="/admin/complaints?overdue=true"
          />
        </div>
      </div>
    </>
  );
}
