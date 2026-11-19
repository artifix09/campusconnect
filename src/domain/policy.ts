import type { Prisma } from "@prisma/client";
import { OPEN_STATUSES, type Actor, type ComplaintRef } from "./types";

/**
 * Authorization rules for complaints (docs/05 section 3).
 *
 * `complaintScope` is the single definition of which complaints an actor can
 * see. Repositories AND it into every query, so out-of-scope rows are never
 * read from the database. `can` answers finer questions about a single
 * complaint the actor already has in scope.
 */
export function complaintScope(actor: Actor): Prisma.ComplaintWhereInput {
  switch (actor.role) {
    case "STUDENT":
      return { studentId: actor.id };
    case "DEPT_ADMIN":
      return { departmentId: actor.departmentId };
    case "SUPER_ADMIN":
      return {};
  }
}

export type ComplaintAction =
  | "read"
  | "comment"
  | "internalNote"
  | "changeStatus"
  | "changePriority"
  | "reassign"
  | "withdraw"
  | "reopen"
  | "rate"
  | "attach"
  | "revealIdentity"
  | "export";

export function can(actor: Actor, action: ComplaintAction, complaint: ComplaintRef): boolean {
  const isOwner = actor.role === "STUDENT" && complaint.studentId === actor.id;
  const isDeptAdmin = actor.role === "DEPT_ADMIN" && complaint.departmentId === actor.departmentId;
  const isSuperAdmin = actor.role === "SUPER_ADMIN";
  const handlesIt = isDeptAdmin || isSuperAdmin;
  const isOpen = OPEN_STATUSES.includes(complaint.status);

  switch (action) {
    case "read":
    case "comment":
      return isOwner || handlesIt;
    case "internalNote":
    case "changeStatus":
    case "changePriority":
    case "export":
      return handlesIt;
    case "attach":
      return (isOwner && isOpen) || handlesIt;
    case "withdraw":
    case "reopen":
    case "rate":
      return isOwner;
    case "reassign":
    case "revealIdentity":
      return isSuperAdmin;
  }
}

/** Department admins never see who filed an anonymous complaint. */
export function canSeeStudentIdentity(actor: Actor, complaint: { studentId: string; isAnonymous: boolean }) {
  if (!complaint.isAnonymous) return actor.role !== "STUDENT" || complaint.studentId === actor.id;
  return actor.role === "STUDENT" && complaint.studentId === actor.id;
}
