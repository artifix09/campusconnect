import { BusinessRuleError, ConflictError, ForbiddenError } from "@/lib/errors";
import type { Actor, ComplaintStatus } from "./types";

type Mover = "OWNER" | "DEPT_ADMIN" | "SUPER_ADMIN";

/** Every legal status change and who may make it (docs/04 section 5). */
export const TRANSITIONS: Record<ComplaintStatus, Partial<Record<ComplaintStatus, readonly Mover[]>>> = {
  PENDING: {
    IN_PROGRESS: ["DEPT_ADMIN", "SUPER_ADMIN"],
    REJECTED: ["DEPT_ADMIN", "SUPER_ADMIN"],
    WITHDRAWN: ["OWNER"],
  },
  IN_PROGRESS: {
    RESOLVED: ["DEPT_ADMIN", "SUPER_ADMIN"],
    REJECTED: ["DEPT_ADMIN", "SUPER_ADMIN"],
  },
  RESOLVED: {
    IN_PROGRESS: ["OWNER"],
  },
  REJECTED: {},
  WITHDRAWN: {},
};

export const MIN_REASON_LENGTH = 10;
export const REOPEN_WINDOW_DAYS = 7;
export const MAX_REOPENS = 1;

export type TransitionInput = {
  from: ComplaintStatus;
  to: ComplaintStatus;
  actor: Actor;
  complaint: { studentId: string; resolvedAt: Date | null; reopenCount: number };
  note?: string | null;
  now?: Date;
};

function moverFor(actor: Actor, studentId: string): Mover | null {
  if (actor.role === "STUDENT") return actor.id === studentId ? "OWNER" : null;
  return actor.role;
}

/** Throws if the transition is illegal or its business rule is not met. */
export function assertTransition({ from, to, actor, complaint, note, now = new Date() }: TransitionInput): void {
  const allowedMovers = TRANSITIONS[from][to];
  if (!allowedMovers) {
    throw new ConflictError(`A complaint cannot move from ${from} to ${to}.`, "illegal-transition");
  }

  const mover = moverFor(actor, complaint.studentId);
  if (!mover || !allowedMovers.includes(mover)) {
    throw new ForbiddenError("You are not allowed to make this status change.");
  }

  const text = note?.trim() ?? "";
  const needsReason = to === "REJECTED" || to === "RESOLVED" || (from === "RESOLVED" && to === "IN_PROGRESS");
  if (needsReason && text.length < MIN_REASON_LENGTH) {
    const what = to === "REJECTED" ? "a rejection reason" : to === "RESOLVED" ? "a resolution note" : "a reason";
    throw new BusinessRuleError(`Please provide ${what} of at least ${MIN_REASON_LENGTH} characters.`, "reason-required");
  }

  if (from === "RESOLVED" && to === "IN_PROGRESS") {
    if (complaint.reopenCount >= MAX_REOPENS) {
      throw new BusinessRuleError("This complaint has already been reopened once.", "reopen-limit");
    }
    const resolvedAt = complaint.resolvedAt;
    const windowMs = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (!resolvedAt || now.getTime() - resolvedAt.getTime() > windowMs) {
      throw new BusinessRuleError(
        `Complaints can only be reopened within ${REOPEN_WINDOW_DAYS} days of being resolved. Please file a new complaint.`,
        "reopen-window",
      );
    }
  }
}

export function canTransition(input: TransitionInput): boolean {
  try {
    assertTransition(input);
    return true;
  } catch {
    return false;
  }
}
