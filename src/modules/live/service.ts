import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/domain/types";

function scopeSql(actor: Actor): Prisma.Sql {
  switch (actor.role) {
    case "STUDENT":
      return Prisma.sql`student_id = ${actor.id}::uuid`;
    case "DEPT_ADMIN":
      return Prisma.sql`department_id = ${actor.departmentId}::uuid`;
    case "SUPER_ADMIN":
      return Prisma.sql`TRUE`;
  }
}

/**
 * A cheap fingerprint of everything this user can see: the newest change to a
 * complaint in their scope plus their notifications. Clients poll it and only
 * reload page data when it changes. Uses the (scope, updated_at) indexes.
 */
export async function changeStamp(actor: Actor): Promise<string> {
  const [row] = await db.$queryRaw<{ complaints: Date | null; notifications: Date | null; unread: bigint }[]>`
    SELECT
      (SELECT max(updated_at) FROM complaint WHERE ${scopeSql(actor)}) AS complaints,
      (SELECT max(created_at) FROM notification WHERE user_id = ${actor.id}::uuid) AS notifications,
      (SELECT count(*) FROM notification WHERE user_id = ${actor.id}::uuid AND read_at IS NULL) AS unread`;
  return [row?.complaints?.getTime() ?? 0, row?.notifications?.getTime() ?? 0, Number(row?.unread ?? 0)].join(".");
}
