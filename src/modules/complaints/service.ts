import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, type Tx } from "@/lib/db";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit } from "@/modules/audit/service";
import {
  departmentAdminIds,
  dispatchAfterResponse,
  queueNotifications,
} from "@/modules/notifications/service";
import { can, canSeeStudentIdentity } from "@/domain/policy";
import { dueAtFor } from "@/domain/sla";
import { assertTransition } from "@/domain/state-machine";
import { toCsv } from "@/domain/csv";
import { OPEN_STATUSES, isStaff, type Actor, type ComplaintStatus } from "@/domain/types";
import { exportRows, findForActor, listForActor, loadDetail, type ComplaintRefRow } from "./repository";
import type {
  ChangePriorityInput,
  ChangeStatusInput,
  CommentInput,
  CreateComplaintInput,
  ExportComplaintsQuery,
  ListComplaintsQuery,
  RatingInput,
  ReassignInput,
  ReopenInput,
  RevealIdentityInput,
  SimilarQuery,
  WithdrawInput,
} from "./schemas";

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const STALE_MESSAGE = "This complaint was updated by someone else. Reload to see the latest version.";

const complaintLink = (id: string, forStaff: boolean) => (forStaff ? `/admin/complaints/${id}` : `/student/complaints/${id}`);

/** Reference numbers read CC-<year>-<sequence>, with the year in Pakistan time. */
async function nextReferenceNo(tx: Tx, now: Date): Promise<string> {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('complaint_ref_seq') AS n`;
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", year: "numeric" }).format(now);
  return `CC-${year}-${String(row!.n).padStart(6, "0")}`;
}

/** Writes only if nobody changed the complaint since we read it (ADR-010). */
async function updateIfUnchanged(tx: Tx, ref: ComplaintRefRow, data: Prisma.ComplaintUncheckedUpdateManyInput) {
  const result = await tx.complaint.updateMany({
    where: { id: ref.id, version: ref.version },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count === 0) throw new ConflictError(STALE_MESSAGE, "stale-version");
}

function checkVersion(ref: ComplaintRefRow, expected?: number) {
  if (expected !== undefined && expected !== ref.version) throw new ConflictError(STALE_MESSAGE, "stale-version");
}

// ---------------------------------------------------------------------------
// Create (FR-02, FR-03)
// ---------------------------------------------------------------------------

export async function createComplaint(actor: Actor, input: CreateComplaintInput, idempotencyKey: string) {
  if (actor.role !== "STUDENT") throw new ForbiddenError("Only students can file complaints.");

  const replay = await db.complaint.findUnique({
    where: { studentId_idempotencyKey: { studentId: actor.id, idempotencyKey } },
    select: { id: true },
  });
  if (replay) return { complaint: await loadDetail(actor, replay.id), replayed: true };

  await enforceRateLimit("createComplaint", actor.id);

  // Routing: the department comes from the category, never from the client (ADR-008).
  const category = await db.category.findFirst({
    where: { id: input.categoryId, isActive: true, department: { isActive: true } },
    select: { id: true, departmentId: true, department: { select: { name: true } } },
  });
  if (!category) throw new BusinessRuleError("That category is not available. Please choose another one.");

  if (input.issueTypeId) {
    const issueType = await db.issueType.count({
      where: { id: input.issueTypeId, categoryId: category.id, isActive: true },
    });
    if (!issueType) throw new BusinessRuleError("That issue type does not belong to the selected category.");
  }

  const now = new Date();
  try {
    const { id, deliveries } = await db.$transaction(async (tx) => {
      const referenceNo = await nextReferenceNo(tx, now);
      const complaint = await tx.complaint.create({
        data: {
          referenceNo,
          studentId: actor.id,
          categoryId: category.id,
          issueTypeId: input.issueTypeId ?? null,
          departmentId: category.departmentId,
          title: input.title,
          description: input.description,
          location: input.location || null,
          isAnonymous: input.isAnonymous,
          priority: "MEDIUM",
          dueAt: dueAtFor("MEDIUM", now),
          idempotencyKey,
          createdAt: now,
        },
        select: { id: true },
      });
      await tx.complaintEvent.create({
        data: { complaintId: complaint.id, actorId: actor.id, type: "CREATED", toStatus: "PENDING" },
      });
      const deliveries = await queueNotifications(tx, {
        userIds: await departmentAdminIds(tx, category.departmentId),
        type: "complaint.created",
        title: `New complaint ${referenceNo}`,
        body: `A new complaint ${referenceNo} was submitted to ${category.department.name}.`,
        link: complaintLink(complaint.id, true),
      });
      return { id: complaint.id, deliveries };
    });

    dispatchAfterResponse(deliveries);
    return { complaint: await loadDetail(actor, id), replayed: false };
  } catch (error) {
    // Two identical offline replays raced each other: return the winner.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.complaint.findUnique({
        where: { studentId_idempotencyKey: { studentId: actor.id, idempotencyKey } },
        select: { id: true },
      });
      if (existing) return { complaint: await loadDetail(actor, existing.id), replayed: true };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function listComplaints(actor: Actor, query: ListComplaintsQuery) {
  return listForActor(actor, query);
}

export async function getComplaint(actor: Actor, id: string) {
  await findForActor(actor, id, "read");
  return loadDetail(actor, id);
}

// ---------------------------------------------------------------------------
// Status changes (FR-05, FR-07, FX-08, FX-14)
// ---------------------------------------------------------------------------

async function transition(
  actor: Actor,
  ref: ComplaintRefRow,
  to: ComplaintStatus,
  note: string | undefined,
  expectedVersion?: number,
) {
  checkVersion(ref, expectedVersion);
  assertTransition({ from: ref.status, to, actor, complaint: ref, note });

  const now = new Date();
  const isReopen = ref.status === "RESOLVED" && to === "IN_PROGRESS";
  const data: Prisma.ComplaintUncheckedUpdateManyInput = { status: to };

  if (isStaff(actor) && !ref.firstResponseAt) data.firstResponseAt = now;
  if (to === "RESOLVED") Object.assign(data, { resolvedAt: now, closedAt: now, resolutionNote: note });
  if (to === "REJECTED") Object.assign(data, { closedAt: now, rejectionReason: note });
  if (to === "WITHDRAWN") data.closedAt = now;
  if (isReopen) {
    Object.assign(data, {
      resolvedAt: null,
      closedAt: null,
      satisfactionRating: null,
      ratingComment: null,
      reopenCount: { increment: 1 },
    });
  }

  const deliveries = await db.$transaction(async (tx) => {
    await updateIfUnchanged(tx, ref, data);
    await tx.complaintEvent.create({
      data: {
        complaintId: ref.id,
        actorId: actor.id,
        type: isReopen ? "REOPENED" : "STATUS_CHANGED",
        fromStatus: ref.status,
        toStatus: to,
        note: note || null,
      },
    });

    if (isStaff(actor)) {
      return queueNotifications(tx, {
        userIds: [ref.studentId],
        type: "complaint.status",
        title: `Complaint ${ref.referenceNo} updated`,
        body: `Your complaint ${ref.referenceNo} is now ${STATUS_LABEL[to]}.`,
        link: complaintLink(ref.id, false),
      });
    }
    return queueNotifications(tx, {
      userIds: await departmentAdminIds(tx, ref.departmentId),
      type: isReopen ? "complaint.reopened" : "complaint.withdrawn",
      title: `Complaint ${ref.referenceNo} ${isReopen ? "reopened" : "withdrawn"}`,
      body: `The student ${isReopen ? "reopened" : "withdrew"} complaint ${ref.referenceNo}.`,
      link: complaintLink(ref.id, true),
    });
  });

  dispatchAfterResponse(deliveries);
  return loadDetail(actor, ref.id);
}

export async function changeStatus(
  actor: Actor,
  id: string,
  input: z.output<typeof ChangeStatusInput>,
  expectedVersion?: number,
) {
  const ref = await findForActor(actor, id, "changeStatus");
  return transition(actor, ref, input.to, input.note, expectedVersion);
}

export async function withdrawComplaint(actor: Actor, id: string, input: z.infer<typeof WithdrawInput>) {
  const ref = await findForActor(actor, id, "withdraw");
  return transition(actor, ref, "WITHDRAWN", input.reason);
}

export async function reopenComplaint(actor: Actor, id: string, input: z.infer<typeof ReopenInput>) {
  const ref = await findForActor(actor, id, "reopen");
  return transition(actor, ref, "IN_PROGRESS", input.reason);
}

// ---------------------------------------------------------------------------
// Priority and reassignment (FX-06, FX-10)
// ---------------------------------------------------------------------------

export async function changePriority(
  actor: Actor,
  id: string,
  input: z.infer<typeof ChangePriorityInput>,
  expectedVersion?: number,
) {
  const ref = await findForActor(actor, id, "changePriority");
  checkVersion(ref, expectedVersion);
  if (!OPEN_STATUSES.includes(ref.status)) throw new BusinessRuleError("Priority can only be changed on open complaints.");
  if (ref.priority === input.priority) return loadDetail(actor, id);

  const dueAt = dueAtFor(input.priority, ref.createdAt);
  const stillInTime = dueAt > new Date();

  await db.$transaction(async (tx) => {
    await updateIfUnchanged(tx, ref, {
      priority: input.priority,
      dueAt,
      ...(stillInTime ? { overdueNotifiedAt: null, escalatedAt: null } : {}),
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: id,
        actorId: actor.id,
        type: "PRIORITY_CHANGED",
        metadata: { from: ref.priority, to: input.priority, dueAt: dueAt.toISOString() },
      },
    });
  });
  return loadDetail(actor, id);
}

export async function reassignComplaint(actor: Actor, id: string, input: z.infer<typeof ReassignInput>) {
  const ref = await findForActor(actor, id, "reassign");
  if (!OPEN_STATUSES.includes(ref.status)) throw new BusinessRuleError("Only open complaints can be reassigned.");
  if (ref.departmentId === input.departmentId) throw new BusinessRuleError("The complaint is already with that department.");

  const target = await db.department.findFirst({
    where: { id: input.departmentId, isActive: true },
    select: { id: true, name: true },
  });
  if (!target) throw new NotFoundError("Department not found.");

  const deliveries = await db.$transaction(async (tx) => {
    await updateIfUnchanged(tx, ref, { departmentId: target.id });
    await tx.complaintEvent.create({
      data: {
        complaintId: id,
        actorId: actor.id,
        type: "REASSIGNED",
        note: input.reason,
        metadata: { fromDepartmentId: ref.departmentId, toDepartmentId: target.id },
      },
    });
    await audit.allowed(tx, actor, {
      action: "complaint.reassign",
      entityType: "Complaint",
      entityId: id,
      metadata: { fromDepartmentId: ref.departmentId, toDepartmentId: target.id, reason: input.reason },
    });
    return queueNotifications(tx, {
      userIds: await departmentAdminIds(tx, target.id),
      type: "complaint.reassigned",
      title: `Complaint ${ref.referenceNo} assigned to you`,
      body: `Complaint ${ref.referenceNo} was reassigned to ${target.name}.`,
      link: complaintLink(id, true),
    });
  });

  dispatchAfterResponse(deliveries);
  return loadDetail(actor, id);
}

// ---------------------------------------------------------------------------
// Rating (FX-08)
// ---------------------------------------------------------------------------

export async function rateComplaint(actor: Actor, id: string, input: z.infer<typeof RatingInput>) {
  const ref = await findForActor(actor, id, "rate");
  if (ref.status !== "RESOLVED") throw new BusinessRuleError("You can rate a complaint once it is resolved.");
  if (ref.satisfactionRating !== null) throw new ConflictError("You have already rated this complaint.", "already-rated");

  await db.$transaction(async (tx) => {
    await updateIfUnchanged(tx, ref, { satisfactionRating: input.rating, ratingComment: input.comment || null });
    await tx.complaintEvent.create({
      data: { complaintId: id, actorId: actor.id, type: "RATED", metadata: { rating: input.rating } },
    });
  });
  return loadDetail(actor, id);
}

// ---------------------------------------------------------------------------
// Conversation (FX-04)
// ---------------------------------------------------------------------------

export async function addComment(actor: Actor, id: string, input: z.infer<typeof CommentInput>) {
  const ref = await findForActor(actor, id, "comment");
  if (ref.status === "WITHDRAWN") throw new BusinessRuleError("This complaint was withdrawn and is closed for comments.");
  await enforceRateLimit("comment", actor.id);

  // Students cannot write internal notes; the flag is silently ignored for them.
  const isInternal = input.isInternal && can(actor, "internalNote", ref);

  const { comment, deliveries } = await db.$transaction(async (tx) => {
    const comment = await tx.complaintComment.create({
      data: { complaintId: id, authorId: actor.id, body: input.body, isInternal },
      select: { id: true, body: true, isInternal: true, createdAt: true },
    });
    if (isInternal) return { comment, deliveries: [] };

    if (isStaff(actor) && !ref.firstResponseAt) {
      await tx.complaint.update({ where: { id }, data: { firstResponseAt: new Date() } });
    }
    await tx.complaintEvent.create({ data: { complaintId: id, actorId: actor.id, type: "COMMENTED" } });

    const deliveries = isStaff(actor)
      ? await queueNotifications(tx, {
          userIds: [ref.studentId],
          type: "complaint.comment",
          title: `New reply on ${ref.referenceNo}`,
          body: `The department replied to your complaint ${ref.referenceNo}.`,
          link: complaintLink(id, false),
        })
      : await queueNotifications(tx, {
          userIds: await departmentAdminIds(tx, ref.departmentId),
          type: "complaint.comment",
          title: `New message on ${ref.referenceNo}`,
          body: `The student added a message to complaint ${ref.referenceNo}.`,
          link: complaintLink(id, true),
        });
    return { comment, deliveries };
  });

  dispatchAfterResponse(deliveries);
  return { ...comment, author: { id: actor.id, name: actor.name, role: actor.role } };
}

export async function listComments(actor: Actor, id: string) {
  const ref = await findForActor(actor, id, "read");
  const showIdentity = canSeeStudentIdentity(actor, ref);
  const comments = await db.complaintComment.findMany({
    where: { complaintId: id, ...(actor.role === "STUDENT" ? { isInternal: false } : {}) },
    select: {
      id: true,
      body: true,
      isInternal: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return comments.map((c) =>
    c.author.id === ref.studentId && !showIdentity
      ? { ...c, author: { id: null, name: "Anonymous student", role: "STUDENT" } }
      : c,
  );
}

// ---------------------------------------------------------------------------
// Similar complaints and "Me too" (FX-07)
// ---------------------------------------------------------------------------

export async function findSimilar(actor: Actor, query: z.infer<typeof SimilarQuery>) {
  if (actor.role !== "STUDENT") throw new ForbiddenError("Only students can look up similar complaints.");

  // Minimal projection on purpose: never description, identity, comments or images.
  const rows = await db.$queryRaw<
    { id: string; referenceNo: string; title: string; status: ComplaintStatus; supportCount: number; createdAt: Date; isMine: boolean; supportedByMe: boolean }[]
  >`
    SELECT c.id, c.reference_no AS "referenceNo", c.title, c.status, c.support_count AS "supportCount",
           c.created_at AS "createdAt",
           (c.student_id = ${actor.id}::uuid) AS "isMine",
           EXISTS (SELECT 1 FROM complaint_support s WHERE s.complaint_id = c.id AND s.user_id = ${actor.id}::uuid) AS "supportedByMe"
    FROM complaint c
    WHERE c.category_id = ${query.categoryId}::uuid
      AND c.status IN ('PENDING', 'IN_PROGRESS')
      AND c.title % ${query.title}
    ORDER BY similarity(c.title, ${query.title}) DESC, c.support_count DESC
    LIMIT 5`;
  return rows;
}

async function findSupportable(actor: Actor, id: string) {
  if (actor.role !== "STUDENT") throw new ForbiddenError("Only students can support complaints.");
  const complaint = await db.complaint.findUnique({
    where: { id },
    select: { id: true, studentId: true, status: true },
  });
  if (!complaint || !OPEN_STATUSES.includes(complaint.status)) throw new NotFoundError("Complaint not found.");
  if (complaint.studentId === actor.id) throw new BusinessRuleError("You cannot support your own complaint.");
  return complaint;
}

export async function supportComplaint(actor: Actor, id: string) {
  await findSupportable(actor, id);
  await enforceRateLimit("support", actor.id);
  try {
    const updated = await db.$transaction(async (tx) => {
      await tx.complaintSupport.create({ data: { complaintId: id, userId: actor.id } });
      return tx.complaint.update({ where: { id }, data: { supportCount: { increment: 1 } }, select: { supportCount: true } });
    });
    return { supported: true, supportCount: updated.supportCount };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You already support this complaint.", "already-supported");
    }
    throw error;
  }
}

export async function unsupportComplaint(actor: Actor, id: string) {
  await findSupportable(actor, id);
  const supportCount = await db.$transaction(async (tx) => {
    const removed = await tx.complaintSupport.deleteMany({ where: { complaintId: id, userId: actor.id } });
    const row = removed.count
      ? await tx.complaint.update({ where: { id }, data: { supportCount: { decrement: 1 } }, select: { supportCount: true } })
      : await tx.complaint.findUniqueOrThrow({ where: { id }, select: { supportCount: true } });
    return row.supportCount;
  });
  return { supported: false, supportCount };
}

// ---------------------------------------------------------------------------
// Anonymous identity reveal (ADR-020) and export (FX-11)
// ---------------------------------------------------------------------------

export async function revealIdentity(actor: Actor, id: string, input: z.infer<typeof RevealIdentityInput>) {
  await findForActor(actor, id, "revealIdentity");
  const complaint = await db.complaint.findUniqueOrThrow({
    where: { id },
    select: { isAnonymous: true, student: { select: { id: true, name: true, email: true, registrationNo: true } } },
  });
  if (!complaint.isAnonymous) throw new BusinessRuleError("This complaint is not anonymous.");

  await db.$transaction(async (tx) => {
    await tx.complaintEvent.create({
      data: { complaintId: id, actorId: actor.id, type: "IDENTITY_REVEALED", note: input.reason },
    });
    await audit.allowed(tx, actor, {
      action: "complaint.reveal-identity",
      entityType: "Complaint",
      entityId: id,
      metadata: { reason: input.reason },
    });
  });
  return complaint.student;
}

export async function exportComplaintsCsv(actor: Actor, filters: z.infer<typeof ExportComplaintsQuery>) {
  if (!isStaff(actor)) throw new ForbiddenError("Only staff can export complaints.");
  await enforceRateLimit("export", actor.id);

  const rows = await exportRows(actor, filters);
  const header = [
    "Reference",
    "Submitted",
    "Category",
    "Issue type",
    "Department",
    "Status",
    "Priority",
    "Title",
    "Student",
    "Due",
    "Overdue",
    "Resolved",
    "Rating",
    "Supporters",
  ];
  const body = rows.map((r) => [
    r.referenceNo,
    r.createdAt,
    r.category.name,
    r.issueType?.name ?? "",
    r.department.name,
    STATUS_LABEL[r.status],
    r.priority,
    r.title,
    r.student.name,
    r.dueAt,
    r.overdue ? "Yes" : "No",
    r.resolvedAt ?? "",
    r.satisfactionRating ?? "",
    r.supportCount,
  ]);
  return toCsv(header, body);
}
