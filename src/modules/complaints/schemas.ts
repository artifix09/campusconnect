import { z } from "zod";
import { COMPLAINT_STATUSES, PRIORITIES } from "@/domain/types";

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

/**
 * Unknown keys are stripped, so a client cannot set departmentId, status,
 * studentId or priority on creation (mass-assignment protection).
 */
export const CreateComplaintInput = z.object({
  categoryId: z.uuid("Choose a category."),
  issueTypeId: z.uuid().nullish(),
  title: text(5, 120, "Title"),
  description: text(20, 5000, "Description"),
  location: z.string().trim().max(120).nullish(),
  isAnonymous: z.boolean().default(false),
});
export type CreateComplaintInput = z.infer<typeof CreateComplaintInput>;

export const IdempotencyKey = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must be at least 8 characters.")
  .max(64, "Idempotency-Key must be at most 64 characters.")
  .regex(/^[A-Za-z0-9_-]+$/, "Idempotency-Key may only contain letters, digits, '-' and '_'.");

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.enum(values)));

export const SORTS = ["-createdAt", "createdAt", "dueAt", "-dueAt", "-priority", "-supportCount"] as const;

export const ListComplaintsQuery = z.object({
  status: csv(COMPLAINT_STATUSES).optional(),
  priority: csv(PRIORITIES).optional(),
  categoryId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  overdue: z.enum(["true", "false"]).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(SORTS).default("-createdAt"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.uuid().optional(),
});
export type ListComplaintsQuery = z.infer<typeof ListComplaintsQuery>;

export const ExportComplaintsQuery = ListComplaintsQuery.omit({ limit: true, cursor: true });

export const ChangeStatusInput = z
  .object({
    to: z.enum(["IN_PROGRESS", "RESOLVED", "REJECTED"]),
    note: z.string().trim().max(2000).optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .transform(({ to, note, reason }) => ({ to, note: to === "REJECTED" ? (reason ?? note) : (note ?? reason) }));

export const ChangePriorityInput = z.object({ priority: z.enum(PRIORITIES) });

export const ReassignInput = z.object({
  departmentId: z.uuid(),
  reason: text(10, 1000, "Reason"),
});

export const WithdrawInput = z.object({ reason: z.string().trim().max(1000).optional() });

export const ReopenInput = z.object({ reason: text(10, 1000, "Reason") });

export const RatingInput = z.object({
  rating: z.number().int().min(1, "Rating must be between 1 and 5.").max(5, "Rating must be between 1 and 5."),
  comment: z.string().trim().max(1000).optional(),
});

export const CommentInput = z.object({
  body: text(1, 2000, "Comment"),
  isInternal: z.boolean().default(false),
});

export const SimilarQuery = z.object({
  categoryId: z.uuid(),
  title: z.string().trim().min(3).max(120),
});

export const RevealIdentityInput = z.object({ reason: text(10, 1000, "Reason") });
