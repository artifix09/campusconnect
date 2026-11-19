import type { Metadata } from "next";
import Link from "next/link";
import { requirePageSession } from "@/lib/page-session";
import { cn } from "@/lib/cn";
import { formatDate, formatHours, STATUS_LABEL } from "@/lib/format";
import { getByDepartment, getByStatus, getSummary, getTopIssues, getTrend } from "@/modules/analytics/service";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { DepartmentBars } from "@/components/charts/department-bars";
import { BarList } from "@/components/charts/bar-list";
import { Gauge } from "@/components/charts/gauge";
import type { ComplaintStatus } from "@/domain/types";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;

const SHORT: Record<string, string> = { CAFETERIA: "Cafeteria", LIBRARY: "Library", LAB_IT: "Labs & IT", ACADEMIC: "Academic" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { actor } = await requirePageSession(["DEPT_ADMIN", "SUPER_ADMIN"]);
  const { range: rangeKey = "90" } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[1];
  const from = range.days ? new Date(Date.now() - range.days * 86_400_000) : undefined;
  const isSuper = actor.role === "SUPER_ADMIN";

  const [summary, trend, byStatus, topIssues, byDepartment] = await Promise.all([
    getSummary(actor, { from }),
    getTrend(actor, { interval: "week", periods: 12 }),
    getByStatus(actor, { from }),
    getTopIssues(actor, { from, limit: 8 }),
    getByDepartment(actor, { from }),
  ]);

  const statusTotal = byStatus.reduce((s, r) => s + r.count, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description={isSuper ? "Trends and recurring issues across the whole campus." : "How your department is doing and what keeps coming up."}
        actions={
          <nav aria-label="Time range" className="flex rounded-full bg-surface p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/analytics?range=${r.key}`}
                aria-current={r.key === range.key ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-ring",
                  r.key === range.key ? "bg-brand-800 text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard featured label="Complaints" value={summary.total} note={`In the last ${range.days ? range.label : "period"}`} />
        <StatCard label="Avg. resolution" value={formatHours(summary.avgResolutionHours)} note="From report to resolved" />
        <StatCard label="On-time rate" value={summary.slaCompliance === null ? "No data" : `${summary.slaCompliance}%`} note="Resolved before the due date" />
        <StatCard label="Satisfaction" value={summary.avgRating === null ? "No data" : `${summary.avgRating}/5`} note="Average student rating" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Received vs resolved" description="Last 12 weeks" />
          <TrendChart
            data={trend.map((t) => ({ label: formatDate(t.period).replace(/ \d{4}$/, ""), created: t.created, resolved: t.resolved }))}
          />
        </Card>
        <Card>
          <CardHeader title="Status breakdown" />
          <Gauge resolved={summary.resolved} inProgress={summary.inProgress} pending={summary.pending} />
          <dl className="mt-5 divide-y divide-line">
            {byStatus.map((s) => (
              <div key={s.status} className="flex justify-between py-2 text-sm">
                <dt className="text-muted">{STATUS_LABEL[s.status as ComplaintStatus] ?? s.status}</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {s.count}
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    {statusTotal ? Math.round((s.count / statusTotal) * 100) : 0}%
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={isSuper ? "Complaints by department" : "Your department"} description="Bar heights share one scale." />
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
        <Card>
          <CardHeader title="Recurring issues" description="Issue types reported most often, with how many students joined in." />
          {topIssues.length === 0 ? (
            <p className="text-sm text-muted">No complaints in this period.</p>
          ) : (
            <BarList
              caption="Most reported issue types"
              items={topIssues.map((t) => ({
                label: t.issueType,
                detail: t.category,
                value: t.total,
                secondary: t.supporters ? `+${t.supporters} me too` : undefined,
              }))}
            />
          )}
        </Card>
      </div>

      {isSuper ? (
        <Card className="mt-4">
          <CardHeader title="Department performance" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Department performance</caption>
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                  <th scope="col" className="py-3 pr-4">Department</th>
                  <th scope="col" className="py-3 pr-4 text-right">Total</th>
                  <th scope="col" className="py-3 pr-4 text-right">Open</th>
                  <th scope="col" className="py-3 pr-4 text-right">Resolved</th>
                  <th scope="col" className="py-3 text-right">Avg. resolution</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {byDepartment.map((d) => (
                  <tr key={d.department.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pr-4 font-medium text-ink">{d.department.name}</th>
                    <td className="py-3 pr-4 text-right">{d.total}</td>
                    <td className="py-3 pr-4 text-right">{d.pending + d.inProgress}</td>
                    <td className="py-3 pr-4 text-right">{d.resolved}</td>
                    <td className="py-3 text-right">{formatHours(d.avgResolutionHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
