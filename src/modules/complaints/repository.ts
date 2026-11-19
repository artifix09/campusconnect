import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "@/modules/audit/service";
import { can, canSeeStudentIdentity, complaintScope, type ComplaintAction } from "@/domain/policy";
import { isOverdue } from "@/domain/sla";
import { OPEN_STATUSES, type Actor } from "@/domain/types";
import type { ListComplaintsQuery } from "./schemas";

/**
 * The only module that reads complaints. Every query takes the actor and
 * ANDs `complaintScope(actor)` into the SQL, so a complaint outside the
 * actor's scope is never loaded (ADR-007, docs/05 section 4).
 */

const refSelect = {
  id: true,
  referenceNo: true,
  studentId: true,
  departmentId: true,
  categoryId: true,
  status: true,
  priority: true,
  version: true,
  isAnonymous: true,
  createdAt: true,
  dueAt: true,
  resolvedAt: true,
  firstResponseAt: true,
  reopenCount: true,
  satisfactionRating: true,
} satisfies Prisma.ComplaintSelect;

export type ComplaintRefRow = Prisma.ComplaintGetPayload<{ select: typeof refSelect }>;

/**
 * Loads a complaint the actor may act on, or throws.
 * Out of scope: 403 (and an audit entry) when it exists, 404 when it does not.
 */
export async function findForActor(actor: Actor, id: string, action: ComplaintAction = "read"): Promise<ComplaintRefRow> {
  const complaint = await db.complaint.findFirst({
    where: { AND: [{ id }, complaintScope(actor)] },
    select: refSelect,
  });

  if (!complaint) {
    const exists = await db.complaint.count({ where: { id } });
    if (!exists) throw new NotFoundError("Complaint not found.");
    await audit.denied(actor, { action: `complaint.${action}`, entityType: "Complaint", entityId: id });
    throw new ForbiddenError("You do not have access to this complaint.");
  }

  if (!can(actor, action, complaint)) {
    await audit.denied(actor, { action: `complaint.${action}`, entityType: "Complaint", entityId: id });
    throw new ForbiddenError("You are not allowed to do this on this complaint.");
  }

  return complaint;
}

// ---------------------------------------------------------------------------
// Presentation: identity masking happens here, on the server.
// ---------------------------------------------------------------------------

const ANONYMOUS = { id: null, name: "Anonymous student", email: null, registrationNo: null } as const;

const listSelect = {
  ...refSelect,
  title: true,
  location: true,
  supportCount: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  issueType: { select: { id: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  student: { select: { id: true, name: true, email: true, registrationNo: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.ComplaintSelect;

type ListRow = Prisma.ComplaintGetPayload<{ select: typeof listSelect }>;

function presentListItem(actor: Actor, row: ListRow) {
  // studentId is dropped on purpose: even a raw ID would let staff correlate anonymous complaints.
  const { _count, student, studentId: _studentId, ...rest } = row;
  return {
    ...rest,
    overdue: isOverdue(row),
    attachmentCount: _count.attachments,
    student: canSeeStudentIdentity(actor, row) ? student : ANONYMOUS,
  };
}

// ---------------------------------------------------------------------------
// Lists and search
// ---------------------------------------------------------------------------

const REFERENCE_PATTERN = /^CC-\d{4}-\d{1,9}$/i;

async function buildFilter(actor: Actor, q: Omit<ListComplaintsQuery, "sort" | "limit" | "cursor">) {
  const and: Prisma.ComplaintWhereInput[] = [complaintScope(actor)];

  if (q.status?.length) and.push({ status: { in: q.status } });
  if (q.priority?.length) and.push({ priority: { in: q.priority } });
  if (q.categoryId) and.push({ categoryId: q.categoryId });
  // For department admins this can only narrow their scope, never widen it.
  if (q.departmentId) and.push({ departmentId: q.departmentId });
  if (q.overdue === "true") and.push({ dueAt: { lt: new Date() }, status: { in: [...OPEN_STATUSES] } });
  if (q.from) and.push({ createdAt: { gte: q.from } });
  if (q.to) and.push({ createdAt: { lte: q.to } });

  if (q.q) {
    if (REFERENCE_PATTERN.test(q.q)) {
      and.push({ referenceNo: q.q.toUpperCase() });
    } else {
      // Full-text candidates; the scope above still applies to every row returned.
      const hits = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM complaint
        WHERE search_vector @@ websearch_to_tsquery('english', ${q.q})
        ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${q.q})) DESC
        LIMIT 1000`;
      and.push({
        OR: [{ id: { in: hits.map((h) => h.id) } }, { title: { contains: q.q, mode: "insensitive" } }],
      });
    }
  }
  return { AND: and } satisfies Prisma.ComplaintWhereInput;
}

function orderFor(sort: ListComplaintsQuery["sort"]): Prisma.ComplaintOrderByWithRelationInput[] {
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return [{ [field]: desc ? "desc" : "asc" }, { id: desc ? "desc" : "asc" }];
}

export async function listForActor(actor: Actor, query: ListComplaintsQuery) {
  const { sort, limit, cursor, ...filters } = query;
  const where = await buildFilter(actor, filters);

  const rows = await db.complaint.findMany({
    where,
    select: listSelect,
    orderBy: orderFor(sort),
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    data: page.map((row) => presentListItem(actor, row)),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function exportRows(actor: Actor, filters: Omit<ListComplaintsQuery, "sort" | "limit" | "cursor">, max = 5000) {
  const rows = await db.complaint.findMany({
    where: await buildFilter(actor, filters),
    select: { ...listSelect, resolvedAt: true, closedAt: true, satisfactionRating: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: max,
  });
  return rows.map((row) => ({ ...presentListItem(actor, row), closedAt: row.closedAt }));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function loadDetail(actor: Actor, id: string) {
  const isStudent = actor.role === "STUDENT";
  const row = await db.complaint.findFirstOrThrow({
    where: { AND: [{ id }, complaintScope(actor)] },
    select: {
      ...listSelect,
      description: true,
      closedAt: true,
      resolutionNote: true,
      rejectionReason: true,
      ratingComment: true,
      attachments: {
        select: { id: true, mimeType: true, sizeBytes: true, width: true, height: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      events: {
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          actor: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: isStudent ? { isInternal: false } : {},
        select: {
          id: true,
          body: true,
          isInternal: true,
          createdAt: true,
          author: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const showIdentity = canSeeStudentIdentity(actor, row);
  const maskPerson = <T extends { id: string; name: string; role: string } | null>(person: T) =>
    person && person.id === row.studentId && !showIdentity ? { id: null, name: ANONYMOUS.name, role: "STUDENT" } : person;

  const { attachments, events, comments, description, closedAt, resolutionNote, rejectionReason, ratingComment } = row;
  return {
    ...presentListItem(actor, row),
    description,
    closedAt,
    resolutionNote,
    rejectionReason,
    ratingComment,
    attachments,
    timeline: events.map((e) => ({ ...e, actor: maskPerson(e.actor) })),
    comments: comments.map((c) => ({ ...c, author: maskPerson(c.author) })),
  };
}
