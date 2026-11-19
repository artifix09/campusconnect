import type { Priority } from "./types";

/** Target resolution time per priority, in hours (docs/04 section 6). */
export const SLA_HOURS: Record<Priority, number> = {
  URGENT: 24,
  HIGH: 72,
  MEDIUM: 7 * 24,
  LOW: 14 * 24,
};

/** Hours past the due date before a complaint is escalated to the Super Admin. */
export const ESCALATION_GRACE_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export function dueAtFor(priority: Priority, from: Date): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * HOUR_MS);
}

export function isOverdue(complaint: { dueAt: Date; status: string }, now = new Date()): boolean {
  return (complaint.status === "PENDING" || complaint.status === "IN_PROGRESS") && complaint.dueAt < now;
}

export function escalationThreshold(now = new Date()): Date {
  return new Date(now.getTime() - ESCALATION_GRACE_HOURS * HOUR_MS);
}
