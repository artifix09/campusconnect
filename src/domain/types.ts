// Domain vocabulary. Kept as string unions so the domain layer has no
// dependency on the generated Prisma client (they match the Prisma enums).

export const ROLES = ["STUDENT", "DEPT_ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const COMPLAINT_STATUSES = ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "WITHDRAWN"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const OPEN_STATUSES: readonly ComplaintStatus[] = ["PENDING", "IN_PROGRESS"];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** The authenticated user, as the domain sees them. */
export type Actor =
  | { id: string; role: "STUDENT"; name: string; email: string }
  | { id: string; role: "DEPT_ADMIN"; departmentId: string; name: string; email: string }
  | { id: string; role: "SUPER_ADMIN"; name: string; email: string };

/** The minimum a policy decision needs to know about a complaint. */
export type ComplaintRef = {
  studentId: string;
  departmentId: string;
  status: ComplaintStatus;
};

export const isStaff = (actor: Actor) => actor.role === "DEPT_ADMIN" || actor.role === "SUPER_ADMIN";
