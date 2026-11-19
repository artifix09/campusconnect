import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Actor } from "@/domain/types";

/**
 * Dashboard numbers straight from SQL aggregates (ADR-016). Every query is
 * filtered by the same scope rule as the complaint lists, so a department
 * admin's charts can never include another department's data.
 */

function scopeSql(actor: Actor, alias = "c"): Prisma.Sql {
  const col = (name: string) => Prisma.raw(`${alias}.${name}`);
  switch (actor.role) {
    case "STUDENT":
      return Prisma.sql`${col("student_id")} = ${actor.id}::uuid`;
    case "DEPT_ADMIN":
      return Prisma.sql`${col("department_id")} = ${actor.departmentId}::uuid`;
    case "SUPER_ADMIN":
      return Prisma.sql`TRUE`;
  }
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await compute();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return value;
}

const scopeKey = (actor: Actor) =>
  actor.role === "SUPER_ADMIN" ? "all" : actor.role === "DEPT_ADMIN" ? `dept:${actor.departmentId}` : `student:${actor.id}`;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const RangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
type Range = z.infer<typeof RangeQuery>;

function rangeSql(range: Range, alias = "c"): Prisma.Sql {
  const createdAt = Prisma.raw(`${alias}.created_at`);
  const parts: Prisma.Sql[] = [];
  if (range.from) parts.push(Prisma.sql`${createdAt} >= ${range.from}`);
  if (range.to) parts.push(Prisma.sql`${createdAt} <= ${range.to}`);
  return parts.length ? Prisma.sql`AND ${Prisma.join(parts, " AND ")}` : Prisma.empty;
}

const rangeKey = (r: Range) => `${r.from?.toISOString() ?? ""}|${r.to?.toISOString() ?? ""}`;

export function getSummary(actor: Actor, range: Range = {}) {
  return cached(`summary:${scopeKey(actor)}:${rangeKey(range)}`, async () => {
    const [row] = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT
        count(*)                                                        AS total,
        count(*) FILTER (WHERE status = 'PENDING')                      AS pending,
        count(*) FILTER (WHERE status = 'IN_PROGRESS')                  AS "inProgress",
        count(*) FILTER (WHERE status = 'RESOLVED')                     AS resolved,
        count(*) FILTER (WHERE status = 'REJECTED')                     AS rejected,
        count(*) FILTER (WHERE status = 'WITHDRAWN')                    AS withdrawn,
        count(*) FILTER (WHERE status IN ('PENDING','IN_PROGRESS') AND due_at < now()) AS overdue,
        round(avg(extract(epoch FROM (resolved_at - created_at)) / 3600)
              FILTER (WHERE status = 'RESOLVED')::numeric, 1)            AS "avgResolutionHours",
        round(avg(extract(epoch FROM (first_response_at - created_at)) / 3600)
              FILTER (WHERE first_response_at IS NOT NULL)::numeric, 1)  AS "avgFirstResponseHours",
        round(100.0 * count(*) FILTER (WHERE status = 'RESOLVED' AND resolved_at <= due_at)
              / nullif(count(*) FILTER (WHERE status = 'RESOLVED'), 0), 1) AS "slaCompliance",
        round(avg(satisfaction_rating)::numeric, 2)                     AS "avgRating"
      FROM complaint c
      WHERE ${scopeSql(actor)} ${rangeSql(range)}`;

    const r = row ?? {};
    return {
      total: num(r.total) ?? 0,
      pending: num(r.pending) ?? 0,
      inProgress: num(r.inProgress) ?? 0,
      resolved: num(r.resolved) ?? 0,
      rejected: num(r.rejected) ?? 0,
      withdrawn: num(r.withdrawn) ?? 0,
      overdue: num(r.overdue) ?? 0,
      avgResolutionHours: num(r.avgResolutionHours),
      avgFirstResponseHours: num(r.avgFirstResponseHours),
      slaCompliance: num(r.slaCompliance),
      avgRating: num(r.avgRating),
    };
  });
}

/** The brief's bar chart: complaints per department, split by status. */
export function getByDepartment(actor: Actor, range: Range = {}) {
  return cached(`by-dept:${scopeKey(actor)}:${rangeKey(range)}`, async () => {
    const deptFilter =
      actor.role === "DEPT_ADMIN" ? Prisma.sql`WHERE d.id = ${actor.departmentId}::uuid` : Prisma.sql`WHERE d.is_active`;
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT d.id, d.code, d.name,
        count(c.id)                                           AS total,
        count(c.id) FILTER (WHERE c.status = 'PENDING')       AS pending,
        count(c.id) FILTER (WHERE c.status = 'IN_PROGRESS')   AS "inProgress",
        count(c.id) FILTER (WHERE c.status = 'RESOLVED')      AS resolved,
        count(c.id) FILTER (WHERE c.status = 'REJECTED')      AS rejected,
        round(avg(extract(epoch FROM (c.resolved_at - c.created_at)) / 3600)
              FILTER (WHERE c.status = 'RESOLVED')::numeric, 1) AS "avgResolutionHours"
      FROM department d
      LEFT JOIN complaint c ON c.department_id = d.id AND ${scopeSql(actor)} ${rangeSql(range)}
      ${deptFilter}
      GROUP BY d.id, d.code, d.name
      ORDER BY total DESC, d.name`;
    return rows.map((r) => ({
      department: { id: r.id as string, code: r.code as string, name: r.name as string },
      total: num(r.total) ?? 0,
      pending: num(r.pending) ?? 0,
      inProgress: num(r.inProgress) ?? 0,
      resolved: num(r.resolved) ?? 0,
      rejected: num(r.rejected) ?? 0,
      avgResolutionHours: num(r.avgResolutionHours),
    }));
  });
}

export function getByStatus(actor: Actor, range: Range = {}) {
  return cached(`by-status:${scopeKey(actor)}:${rangeKey(range)}`, async () => {
    const rows = await db.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, count(*) AS count FROM complaint c
      WHERE ${scopeSql(actor)} ${rangeSql(range)}
      GROUP BY status ORDER BY status`;
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  });
}

export const TrendQuery = z.object({
  interval: z.enum(["day", "week", "month"]).default("week"),
  periods: z.coerce.number().int().min(1).max(52).default(12),
});

/** Complaints created vs resolved per period, with empty periods filled in. */
export function getTrend(actor: Actor, query: z.infer<typeof TrendQuery>) {
  return cached(`trend:${scopeKey(actor)}:${query.interval}:${query.periods}`, async () => {
    const unit = Prisma.raw(`'${query.interval}'`);
    const step = Prisma.raw(`'1 ${query.interval}'`);
    const rows = await db.$queryRaw<{ period: Date; created: bigint; resolved: bigint }[]>`
      WITH periods AS (
        SELECT generate_series(
          date_trunc(${unit}, now()) - (${query.periods - 1}::int * interval ${step}),
          date_trunc(${unit}, now()),
          interval ${step}
        ) AS period
      )
      SELECT p.period,
        (SELECT count(*) FROM complaint c
          WHERE ${scopeSql(actor)} AND date_trunc(${unit}, c.created_at) = p.period) AS created,
        (SELECT count(*) FROM complaint c
          WHERE ${scopeSql(actor)} AND c.resolved_at IS NOT NULL
            AND date_trunc(${unit}, c.resolved_at) = p.period) AS resolved
      FROM periods p ORDER BY p.period`;
    return rows.map((r) => ({ period: r.period, created: Number(r.created), resolved: Number(r.resolved) }));
  });
}

export const TopIssuesQuery = RangeQuery.extend({
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/** Most frequent issue types: the "recurring problems" view. */
export function getTopIssues(actor: Actor, query: z.infer<typeof TopIssuesQuery>) {
  return cached(`top:${scopeKey(actor)}:${rangeKey(query)}:${query.limit}`, async () => {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT coalesce(i.name, 'Other') AS "issueType", cat.name AS category, cat.code AS "categoryCode",
             count(*) AS total, sum(c.support_count) AS supporters,
             count(*) FILTER (WHERE c.status IN ('PENDING','IN_PROGRESS')) AS open
      FROM complaint c
      JOIN category cat ON cat.id = c.category_id
      LEFT JOIN issue_type i ON i.id = c.issue_type_id
      WHERE ${scopeSql(actor)} ${rangeSql(query)}
      GROUP BY 1, 2, 3
      ORDER BY total DESC, supporters DESC
      LIMIT ${query.limit}`;
    return rows.map((r) => ({
      issueType: r.issueType as string,
      category: r.category as string,
      categoryCode: r.categoryCode as string,
      total: num(r.total) ?? 0,
      open: num(r.open) ?? 0,
      supporters: num(r.supporters) ?? 0,
    }));
  });
}
