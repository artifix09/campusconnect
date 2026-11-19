#!/usr/bin/env node
/**
 * End-to-end API check against a running server with seeded demo data.
 * Walks the full complaint lifecycle and the brief's access-control scenarios.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/smoke-test.mjs [baseUrl]
 */
import { randomUUID } from "node:crypto";

const BASE = process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000";
const DOMAIN = (process.env.ALLOWED_EMAIL_DOMAINS ?? "biit.edu.pk").split(",")[0].trim();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Campus#Connect2026";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`);
  if (!ok) failures++;
};

async function signIn(email) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      redirect: "manual",
      headers: { Origin: BASE, Cookie: cookie, "Content-Type": "application/json", ...init.headers },
    });
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`);
  check("health endpoint responds", health.ok);

  const anonymous = await fetch(`${BASE}/api/v1/complaints`);
  check("unauthenticated request is rejected with 401", anonymous.status === 401, anonymous.status);

  const student = await signIn(`student1@${DOMAIN}`);
  const otherStudent = await signIn(`student2@${DOMAIN}`);
  const labAdmin = await signIn(`labit.admin@${DOMAIN}`);
  const libraryAdmin = await signIn(`library.admin@${DOMAIN}`);
  const superAdmin = await signIn(`superadmin@${DOMAIN}`);

  // 1. Student files a Lab/IT complaint; the server routes it.
  const categories = (await (await student("/api/v1/categories")).json()).data;
  const labIt = categories.find((c) => c.code === "LAB_IT");
  const key = randomUUID();
  const body = JSON.stringify({
    categoryId: labIt.id,
    issueTypeId: labIt.issueTypes.find((t) => t.name === "Internet connectivity")?.id,
    title: "Smoke test: Wi-Fi down in Lab 5",
    description: "Created by the automated smoke test to verify routing and access control.",
    departmentId: "00000000-0000-7000-8000-000000000000",
    status: "RESOLVED",
  });
  const createdRes = await student("/api/v1/complaints", { method: "POST", headers: { "Idempotency-Key": key }, body });
  const complaint = await createdRes.json();
  check("student creates a complaint (201)", createdRes.status === 201, createdRes.status);
  check("complaint is routed to Laboratory / IT", complaint.department?.code === "LAB_IT", complaint.department?.code);
  check("client-supplied status is ignored", complaint.status === "PENDING", complaint.status);

  const replay = await student("/api/v1/complaints", { method: "POST", headers: { "Idempotency-Key": key }, body });
  const replayed = await replay.json();
  check("idempotent replay returns the same complaint (200)", replay.status === 200 && replayed.id === complaint.id);

  // 2. The brief's scenario: Library admin opens a Lab/IT complaint by URL.
  const denied = await libraryAdmin(`/api/v1/complaints/${complaint.id}`);
  check("library admin is denied a Lab/IT complaint (403)", denied.status === 403, denied.status);

  const deniedStatus = await libraryAdmin(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ to: "IN_PROGRESS" }),
  });
  check("library admin cannot change its status (403)", deniedStatus.status === 403, deniedStatus.status);

  const strangerRes = await otherStudent(`/api/v1/complaints/${complaint.id}`);
  check("another student is denied (403)", strangerRes.status === 403, strangerRes.status);

  const libraryList = await (await libraryAdmin("/api/v1/complaints?limit=100")).json();
  check(
    "library admin's list contains only library complaints",
    libraryList.data.every((c) => c.department.code === "LIBRARY"),
  );

  const studentStatus = await student(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ to: "RESOLVED", note: "I resolved it myself." }),
  });
  check("student cannot change status (403)", studentStatus.status === 403, studentStatus.status);

  // 3. Lab/IT admin works the complaint.
  const visible = await labAdmin(`/api/v1/complaints/${complaint.id}`);
  check("Lab/IT admin can open it", visible.status === 200, visible.status);

  const started = await labAdmin(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    headers: { "If-Match": '"1"' },
    body: JSON.stringify({ to: "IN_PROGRESS" }),
  });
  check("Lab/IT admin starts work", started.status === 200, started.status);

  const stale = await labAdmin(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    headers: { "If-Match": '"1"' },
    body: JSON.stringify({ to: "RESOLVED", note: "Router restarted and tested." }),
  });
  check("stale version is rejected (409)", stale.status === 409, stale.status);

  const noNote = await labAdmin(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ to: "RESOLVED" }),
  });
  check("resolving without a note is refused (422)", noNote.status === 422, noNote.status);

  const internal = await labAdmin(`/api/v1/complaints/${complaint.id}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: "Internal: switch in rack 2 is faulty.", isInternal: true }),
  });
  check("staff add an internal note", internal.status === 201, internal.status);

  const resolved = await labAdmin(`/api/v1/complaints/${complaint.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ to: "RESOLVED", note: "Router restarted and all 40 PCs tested online." }),
  });
  check("Lab/IT admin resolves it with a note", resolved.status === 200, resolved.status);

  // 4. Student sees the outcome, never the internal note, and rates it.
  const detail = await (await student(`/api/v1/complaints/${complaint.id}`)).json();
  check("student sees RESOLVED with the timeline", detail.status === "RESOLVED" && detail.timeline.length >= 3);
  check("student never sees internal notes", detail.comments.every((c) => !c.isInternal));

  const rated = await student(`/api/v1/complaints/${complaint.id}/rating`, {
    method: "POST",
    body: JSON.stringify({ rating: 5, comment: "Fixed quickly." }),
  });
  check("student rates the resolution", rated.status === 200, rated.status);

  // 5. Dashboards respect scope.
  const all = await (await superAdmin("/api/v1/analytics/by-department")).json();
  const own = await (await libraryAdmin("/api/v1/analytics/by-department")).json();
  check("super admin sees every department in the bar chart data", all.data.length >= 4);
  check(
    "library admin sees only the library in analytics",
    own.data.length === 1 && own.data[0].department.code === "LIBRARY",
  );

  const exportRes = await libraryAdmin("/api/v1/complaints/export.csv");
  check("library admin can export their CSV", exportRes.status === 200 && (await exportRes.text()).startsWith("Reference"));

  const studentAnalytics = await student("/api/v1/analytics/by-department");
  check("students cannot read department analytics (403)", studentAnalytics.status === 403, studentAnalytics.status);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
