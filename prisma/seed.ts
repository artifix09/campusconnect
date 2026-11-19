/**
 * Seeds departments, categories (the routing table), issue types and staff
 * accounts. Outside production it also creates demo students and about 60
 * complaints spread over the last 8 weeks so dashboards have realistic data.
 *
 * Safe to run more than once: reference data is upserted, demo data is only
 * created when the database has no complaints yet.
 *
 *   npm run db:seed
 */
import { randomBytes } from "node:crypto";
import { PrismaClient, type ComplaintStatus, type Priority } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { v7 as uuidv7 } from "uuid";

const db = new PrismaClient();
const isProduction = process.env.APP_ENV === "production";
const domain = (process.env.ALLOWED_EMAIL_DOMAINS ?? "").split(",")[0]?.trim() || "campusconnect.local";

const DEPARTMENTS = [
  { code: "CAFETERIA", name: "Cafeteria Administration" },
  { code: "LIBRARY", name: "Library Administration" },
  { code: "LAB_IT", name: "Laboratory / IT Administration" },
  { code: "ACADEMIC", name: "Teaching Manager / Academic Coordination" },
] as const;

const CATEGORIES = [
  {
    code: "CAFETERIA",
    name: "Cafeteria",
    description: "Food quality, hygiene, prices, variety and service in the cafeteria.",
    department: "CAFETERIA",
    issueTypes: ["Food quality or hygiene", "High food prices", "Limited food variety", "Staff behaviour or service", "Other"],
  },
  {
    code: "LIBRARY",
    name: "Library",
    description: "Books and resources, librarian availability, opening hours and study space.",
    department: "LIBRARY",
    issueTypes: [
      "Books or learning resources",
      "Librarian availability or behaviour",
      "Opening and closing hours",
      "Seating or study space",
      "Other",
    ],
  },
  {
    code: "LAB_IT",
    name: "Laboratories & IT Facilities",
    description: "Computers, internet, projectors and software in labs and classrooms.",
    department: "LAB_IT",
    issueTypes: ["Non-functional computers", "Internet connectivity", "Projector or multimedia", "Missing software", "Other"],
  },
  {
    code: "ACADEMIC",
    name: "Teaching & Academic Affairs",
    description: "Punctuality, learning materials, teaching quality and classroom management.",
    department: "ACADEMIC",
    issueTypes: [
      "Teacher late to lecture",
      "Notes or materials unavailable",
      "Inadequate explanation of topics",
      "Classroom management or discipline",
      "Other",
    ],
  },
] as const;

const STAFF = [
  { email: `superadmin@${domain}`, name: "Super Administrator", role: "SUPER_ADMIN", department: null },
  { email: `cafeteria.admin@${domain}`, name: "Cafeteria Administrator", role: "DEPT_ADMIN", department: "CAFETERIA" },
  { email: `library.admin@${domain}`, name: "Library Administrator", role: "DEPT_ADMIN", department: "LIBRARY" },
  { email: `labit.admin@${domain}`, name: "Lab / IT Administrator", role: "DEPT_ADMIN", department: "LAB_IT" },
  { email: `academic.admin@${domain}`, name: "Academic Administrator", role: "DEPT_ADMIN", department: "ACADEMIC" },
] as const;

async function seedOrganization() {
  const departmentIds = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const row = await db.department.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, contactEmail: `${d.code.toLowerCase().replace("_", "")}@${domain}` },
      update: { name: d.name },
    });
    departmentIds.set(d.code, row.id);
  }

  for (const [index, c] of CATEGORIES.entries()) {
    const category = await db.category.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        description: c.description,
        sortOrder: index,
        departmentId: departmentIds.get(c.department)!,
      },
      update: { name: c.name, description: c.description },
    });
    for (const [order, name] of c.issueTypes.entries()) {
      await db.issueType.upsert({
        where: { categoryId_name: { categoryId: category.id, name } },
        create: { categoryId: category.id, name, sortOrder: order },
        update: {},
      });
    }
  }
  return departmentIds;
}

async function createUser(opts: {
  email: string;
  name: string;
  role: "STUDENT" | "DEPT_ADMIN" | "SUPER_ADMIN";
  departmentId: string | null;
  password: string;
  registrationNo?: string;
  mustChangePassword?: boolean;
}) {
  const existing = await db.user.findUnique({ where: { email: opts.email } });
  if (existing) return { user: existing, created: false };

  const id = uuidv7();
  const user = await db.user.create({
    data: {
      id,
      email: opts.email,
      name: opts.name,
      emailVerified: true,
      role: opts.role,
      departmentId: opts.departmentId,
      registrationNo: opts.registrationNo,
      mustChangePassword: opts.mustChangePassword ?? false,
      accounts: {
        create: { id: uuidv7(), accountId: id, providerId: "credential", password: await hashPassword(opts.password) },
      },
    },
  });
  return { user, created: true };
}

async function seedStaff(departmentIds: Map<string, string>) {
  const credentials: { email: string; password: string }[] = [];
  for (const s of STAFF) {
    const password = isProduction
      ? randomBytes(12).toString("base64url")
      : (process.env.SEED_ADMIN_PASSWORD ?? "Campus#Connect2026");
    const { created } = await createUser({
      email: s.email,
      name: s.name,
      role: s.role,
      departmentId: s.department ? departmentIds.get(s.department)! : null,
      password,
      mustChangePassword: isProduction,
    });
    if (created) credentials.push({ email: s.email, password });
  }
  return credentials;
}

// ---------------------------------------------------------------------------
// Demo data (never in production)
// ---------------------------------------------------------------------------

const SAMPLE_COMPLAINTS: Record<string, { title: string; description: string; issue: string }[]> = {
  CAFETERIA: [
    { title: "Stale bread served at breakfast", description: "The bread at the breakfast counter was stale and had a bad smell on Monday morning.", issue: "Food quality or hygiene" },
    { title: "Price of tea increased again", description: "The price of a cup of tea went up twice this month without any notice on the board.", issue: "High food prices" },
    { title: "Same three dishes every day", description: "The lunch menu has had the same three dishes for two weeks. Please add more options.", issue: "Limited food variety" },
    { title: "Tables not cleaned after lunch", description: "Tables near the window stay dirty for hours after lunch, attracting flies.", issue: "Food quality or hygiene" },
  ],
  LIBRARY: [
    { title: "Only two copies of the OOP textbook", description: "The library has only two copies of the Object Oriented Programming textbook for over 200 students.", issue: "Books or learning resources" },
    { title: "Library closes before evening classes end", description: "The library closes at 5 PM but evening students finish class at 6 PM and cannot borrow books.", issue: "Opening and closing hours" },
    { title: "Not enough seats during exams", description: "During exam week students sit on the floor because all seats in the reading hall are taken.", issue: "Seating or study space" },
  ],
  LAB_IT: [
    { title: "Internet down in Lab 3", description: "No computer in Lab 3 can reach the internet since 9 AM. Our practical is at 11.", issue: "Internet connectivity" },
    { title: "Five PCs not booting in Lab 1", description: "Five computers in the back row of Lab 1 show a black screen and do not boot.", issue: "Non-functional computers" },
    { title: "Projector flickering in Room 204", description: "The projector in Room 204 flickers every few seconds, making slides hard to read.", issue: "Projector or multimedia" },
    { title: "Android Studio missing in Lab 2", description: "Android Studio is not installed on Lab 2 machines although the mobile apps course needs it.", issue: "Missing software" },
  ],
  ACADEMIC: [
    { title: "Lecture regularly starts 20 minutes late", description: "The morning Data Structures lecture has started at least 20 minutes late for three weeks.", issue: "Teacher late to lecture" },
    { title: "Slides not shared after lectures", description: "Slides for the Database Systems course are not shared after lectures, making revision difficult.", issue: "Notes or materials unavailable" },
    { title: "Too much noise in the back rows", description: "Students in the back rows talk throughout the lecture and nobody manages the class.", issue: "Classroom management or discipline" },
  ],
};

const STATUS_PLAN: { status: ComplaintStatus; weight: number }[] = [
  { status: "PENDING", weight: 3 },
  { status: "IN_PROGRESS", weight: 3 },
  { status: "RESOLVED", weight: 5 },
  { status: "REJECTED", weight: 1 },
];

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length]!;
}

function pickStatus(i: number): ComplaintStatus {
  const total = STATUS_PLAN.reduce((sum, s) => sum + s.weight, 0);
  let n = (i * 7) % total;
  for (const s of STATUS_PLAN) {
    if (n < s.weight) return s.status;
    n -= s.weight;
  }
  return "PENDING";
}

const SLA_HOURS: Record<Priority, number> = { URGENT: 24, HIGH: 72, MEDIUM: 168, LOW: 336 };
const HOUR = 60 * 60 * 1000;

async function seedDemo() {
  if ((await db.complaint.count()) > 0) return 0;

  const password = process.env.SEED_ADMIN_PASSWORD ?? "Campus#Connect2026";
  const students = [];
  for (let i = 1; i <= 6; i++) {
    const { user } = await createUser({
      email: `student${i}@${domain}`,
      name: ["Ayesha Malik", "Hamza Ali", "Fatima Noor", "Usman Tariq", "Zainab Shah", "Bilal Ahmed"][i - 1]!,
      role: "STUDENT",
      departmentId: null,
      password,
      registrationNo: `2023-ARID-${String(4100 + i).padStart(4, "0")}`,
    });
    students.push(user);
  }

  const staff = await db.user.findMany({ where: { role: "DEPT_ADMIN" }, select: { id: true, departmentId: true } });
  const categories = await db.category.findMany({ include: { issueTypes: true } });
  const priorities: Priority[] = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "URGENT"];

  let count = 0;
  for (let i = 0; i < 60; i++) {
    const category = pick(categories, i * 3 + (i % 2));
    const samples = SAMPLE_COMPLAINTS[category.code] ?? [];
    const sample = pick(samples, i);
    const issueType = category.issueTypes.find((t) => t.name === sample.issue) ?? null;
    const student = pick(students, i * 5);
    const admin = staff.find((s) => s.departmentId === category.departmentId);
    const status = pickStatus(i);
    const priority = pick(priorities, i);
    const createdAt = new Date(Date.now() - ((i * 37) % (56 * 24)) * HOUR - 2 * HOUR);
    const dueAt = new Date(createdAt.getTime() + SLA_HOURS[priority] * HOUR);
    const respondedAt = new Date(createdAt.getTime() + (4 + (i % 30)) * HOUR);
    const closedAt = new Date(respondedAt.getTime() + (6 + ((i * 11) % 120)) * HOUR);
    const isClosed = status === "RESOLVED" || status === "REJECTED";
    const finishedAt = closedAt > new Date() ? new Date() : closedAt;

    const [ref] = await db.$queryRaw<{ n: bigint }[]>`SELECT nextval('complaint_ref_seq') AS n`;
    const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", year: "numeric" }).format(createdAt);

    const complaint = await db.complaint.create({
      data: {
        referenceNo: `CC-${year}-${String(ref!.n).padStart(6, "0")}`,
        studentId: student.id,
        categoryId: category.id,
        issueTypeId: issueType?.id,
        departmentId: category.departmentId,
        title: sample.title,
        description: sample.description,
        status,
        priority,
        isAnonymous: category.code === "ACADEMIC" && i % 2 === 0,
        dueAt,
        createdAt,
        firstResponseAt: status === "PENDING" ? null : respondedAt,
        resolvedAt: status === "RESOLVED" ? finishedAt : null,
        closedAt: isClosed ? finishedAt : null,
        resolutionNote: status === "RESOLVED" ? "The issue was investigated and fixed. Thank you for reporting it." : null,
        rejectionReason: status === "REJECTED" ? "This is outside the department's responsibility; it has been referred to the relevant office." : null,
        satisfactionRating: status === "RESOLVED" && i % 3 !== 0 ? 3 + (i % 3) : null,
        supportCount: i % 4,
        events: {
          create: [
            { actorId: student.id, type: "CREATED", toStatus: "PENDING", createdAt },
            ...(status !== "PENDING"
              ? [{ actorId: admin?.id, type: "STATUS_CHANGED" as const, fromStatus: "PENDING" as const, toStatus: status === "REJECTED" ? ("REJECTED" as const) : ("IN_PROGRESS" as const), createdAt: respondedAt }]
              : []),
            ...(status === "RESOLVED"
              ? [{ actorId: admin?.id, type: "STATUS_CHANGED" as const, fromStatus: "IN_PROGRESS" as const, toStatus: "RESOLVED" as const, note: "The issue was investigated and fixed. Thank you for reporting it.", createdAt: finishedAt }]
              : []),
          ],
        },
      },
    });

    if (status === "IN_PROGRESS" && admin) {
      await db.complaintComment.create({
        data: {
          complaintId: complaint.id,
          authorId: admin.id,
          body: "Thank you, we are looking into this and will update you soon.",
          createdAt: respondedAt,
        },
      });
    }
    count++;
  }
  return count;
}

async function main() {
  const departmentIds = await seedOrganization();
  const credentials = await seedStaff(departmentIds);

  console.log(`Seeded ${DEPARTMENTS.length} departments and ${CATEGORIES.length} categories.`);
  if (credentials.length) {
    console.log("\nStaff accounts created:");
    for (const c of credentials) console.log(`  ${c.email.padEnd(36)} ${c.password}`);
    if (isProduction) console.log("\nStore these one-time passwords securely. Each must be changed at first sign-in.");
  }

  if (!isProduction) {
    const demo = await seedDemo();
    if (demo) console.log(`\nDemo data: 6 students (student1..6@${domain}) and ${demo} complaints.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
