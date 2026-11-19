import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { emailLayout, sendEmail } from "@/lib/mailer";
import { runAfterResponse } from "@/lib/background";
import { hashPassword } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { audit } from "@/modules/audit/service";
import type { Actor } from "@/domain/types";

// ---------------------------------------------------------------------------
// Reference data for the complaint form
// ---------------------------------------------------------------------------

export async function listCategories() {
  return db.category.findMany({
    where: { isActive: true, department: { isActive: true } },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      department: { select: { id: true, code: true, name: true } },
      issueTypes: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listDepartments(actor: Actor) {
  if (actor.role === "STUDENT") throw new ForbiddenError();
  return db.department.findMany({
    where: actor.role === "DEPT_ADMIN" ? { id: actor.departmentId } : {},
    select: { id: true, code: true, name: true, contactEmail: true, isActive: true },
    orderBy: { name: "asc" },
  });
}

function requireSuperAdmin(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") throw new ForbiddenError("Only the Super Admin can manage the organization.");
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,31}$/, "Use 2 to 32 capital letters, digits or underscores.");

export const DepartmentInput = z.object({
  code,
  name: z.string().trim().min(3).max(120),
  contactEmail: z.email().nullish(),
});

export const DepartmentUpdate = DepartmentInput.omit({ code: true }).partial().extend({ isActive: z.boolean().optional() });

export async function createDepartment(actor: Actor, input: z.infer<typeof DepartmentInput>) {
  requireSuperAdmin(actor);
  return db.$transaction(async (tx) => {
    const department = await tx.department.create({ data: input });
    await audit.allowed(tx, actor, { action: "department.create", entityType: "Department", entityId: department.id });
    return department;
  });
}

export async function updateDepartment(actor: Actor, id: string, input: z.infer<typeof DepartmentUpdate>) {
  requireSuperAdmin(actor);
  return db.$transaction(async (tx) => {
    const department = await tx.department.update({ where: { id }, data: input });
    await audit.allowed(tx, actor, {
      action: "department.update",
      entityType: "Department",
      entityId: id,
      metadata: input,
    });
    return department;
  });
}

// ---------------------------------------------------------------------------
// Categories, issue types and routing (ADR-008)
// ---------------------------------------------------------------------------

export const CategoryInput = z.object({
  code,
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).nullish(),
  departmentId: z.uuid(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  issueTypes: z.array(z.string().trim().min(2).max(120)).max(30).default([]),
});

export const CategoryUpdate = CategoryInput.omit({ code: true, issueTypes: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const IssueTypeInput = z.object({
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export async function listAllCategories(actor: Actor) {
  requireSuperAdmin(actor);
  return db.category.findMany({
    include: {
      department: { select: { id: true, code: true, name: true } },
      issueTypes: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      _count: { select: { complaints: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(actor: Actor, input: z.infer<typeof CategoryInput>) {
  requireSuperAdmin(actor);
  const { issueTypes, ...data } = input;
  return db.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: { ...data, issueTypes: { create: issueTypes.map((name, i) => ({ name, sortOrder: i })) } },
      include: { issueTypes: true },
    });
    await audit.allowed(tx, actor, {
      action: "category.create",
      entityType: "Category",
      entityId: category.id,
      metadata: { departmentId: data.departmentId },
    });
    return category;
  });
}

/**
 * Changing departmentId changes routing for future complaints only; existing
 * complaints keep the department they were routed to.
 */
export async function updateCategory(actor: Actor, id: string, input: z.infer<typeof CategoryUpdate>) {
  requireSuperAdmin(actor);
  return db.$transaction(async (tx) => {
    const before = await tx.category.findUnique({ where: { id }, select: { departmentId: true } });
    if (!before) throw new NotFoundError("Category not found.");
    const category = await tx.category.update({ where: { id }, data: input });
    await audit.allowed(tx, actor, {
      action: input.departmentId && input.departmentId !== before.departmentId ? "category.reroute" : "category.update",
      entityType: "Category",
      entityId: id,
      metadata: { ...input, previousDepartmentId: before.departmentId },
    });
    return category;
  });
}

export async function addIssueType(actor: Actor, categoryId: string, input: z.infer<typeof IssueTypeInput>) {
  requireSuperAdmin(actor);
  return db.issueType.create({ data: { categoryId, ...input } });
}

// ---------------------------------------------------------------------------
// Staff accounts (docs/05 section 2: admins never self-register)
// ---------------------------------------------------------------------------

export const ListUsersQuery = z.object({
  role: z.enum(["STUDENT", "DEPT_ADMIN", "SUPER_ADMIN"]).optional(),
  departmentId: z.uuid().optional(),
  q: z.string().trim().min(2).max(100).optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.uuid().optional(),
});

export async function listUsers(actor: Actor, query: z.infer<typeof ListUsersQuery>) {
  requireSuperAdmin(actor);
  const rows = await db.user.findMany({
    where: {
      role: query.role,
      departmentId: query.departmentId,
      ...(query.active ? { isActive: query.active === "true" } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
              { registrationNo: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      registrationNo: true,
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
      department: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
}

export const CreateAdminInput = z
  .object({
    name: z.string().trim().min(3).max(120),
    email: z.email().transform((e) => e.toLowerCase()),
    role: z.enum(["DEPT_ADMIN", "SUPER_ADMIN"]),
    departmentId: z.uuid().nullish(),
  })
  .refine((v) => v.role !== "DEPT_ADMIN" || Boolean(v.departmentId), {
    message: "A department admin needs a department.",
    path: ["departmentId"],
  });

export function temporaryPassword() {
  return randomBytes(12).toString("base64url");
}

/** Creates a staff account with a one-time password that must be changed on first sign-in. */
export async function createAdmin(actor: Actor, input: z.infer<typeof CreateAdminInput>) {
  requireSuperAdmin(actor);
  const departmentId = input.role === "DEPT_ADMIN" ? input.departmentId! : null;
  if (departmentId) {
    const department = await db.department.count({ where: { id: departmentId, isActive: true } });
    if (!department) throw new NotFoundError("Department not found.");
  }
  if (await db.user.count({ where: { email: input.email } })) {
    throw new ConflictError("An account with this email already exists.");
  }

  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  const userId = newId();

  const user = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        emailVerified: true,
        role: input.role,
        departmentId,
        mustChangePassword: true,
        accounts: { create: { id: newId(), accountId: userId, providerId: "credential", password: passwordHash } },
      },
      select: { id: true, name: true, email: true, role: true, departmentId: true, createdAt: true },
    });
    await audit.allowed(tx, actor, {
      action: "user.create-admin",
      entityType: "User",
      entityId: user.id,
      metadata: { role: input.role, departmentId },
    });
    return user;
  });

  runAfterResponse("admin-welcome-email", async () => {
    const { html, text } = emailLayout({
      heading: "Your CampusConnect staff account",
      paragraphs: [
        `Hello ${user.name},`,
        "A CampusConnect staff account has been created for you.",
        `Your one-time password is: ${password}`,
        "You will be asked to choose a new password and set up two-factor authentication when you first sign in.",
      ],
      action: { label: "Sign in", url: new URL("/login", env.APP_URL).toString() },
    });
    await sendEmail({ to: user.email, subject: "Your CampusConnect staff account", html, text });
  });

  return user;
}

export const UpdateUserInput = z.object({
  isActive: z.boolean().optional(),
  departmentId: z.uuid().optional(),
  name: z.string().trim().min(3).max(120).optional(),
});

export async function updateUser(actor: Actor, id: string, input: z.infer<typeof UpdateUserInput>) {
  requireSuperAdmin(actor);
  if (id === actor.id && input.isActive === false) {
    throw new BusinessRuleError("You cannot deactivate your own account.");
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) throw new NotFoundError("User not found.");
  if (input.departmentId && target.role !== "DEPT_ADMIN") {
    throw new BusinessRuleError("Only department admins belong to a department.");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: input,
      select: { id: true, name: true, email: true, role: true, departmentId: true, isActive: true },
    });
    // Deactivation and department moves take effect immediately: end every session.
    if (input.isActive === false || input.departmentId) {
      await tx.session.deleteMany({ where: { userId: id } });
    }
    await audit.allowed(tx, actor, { action: "user.update", entityType: "User", entityId: id, metadata: input });
    return user;
  });
}

// ---------------------------------------------------------------------------
// Audit log viewer
// ---------------------------------------------------------------------------

export const AuditQuery = z.object({
  actorId: z.uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  entityId: z.string().trim().max(64).optional(),
  outcome: z.enum(["ALLOWED", "DENIED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.uuid().optional(),
});

export async function listAuditLog(actor: Actor, query: z.infer<typeof AuditQuery>) {
  requireSuperAdmin(actor);
  const rows = await db.auditLog.findMany({
    where: {
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      outcome: query.outcome,
      createdAt: { gte: query.from, lte: query.to },
    },
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  return { data, nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null };
}
