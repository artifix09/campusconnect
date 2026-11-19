# 06 · API Design

> **Style:** resource-oriented REST over HTTPS + JSON, versioned under `/api/v1`, documented with OpenAPI 3.1 generated from Zod schemas. Web UI forms use Server Actions that call **the same service functions** (ADR-017).

## 1. Conventions

| Topic | Convention | Why |
|---|---|---|
| Base path | `/api/v1` | Lets a future breaking change ship as `/api/v2` without breaking installed PWAs |
| Auth | Session cookie (httpOnly). No tokens in URLs or `localStorage`. | XSS can't steal the session, and the cookie is sent automatically |
| Content type | `application/json`. Uploads use `multipart/form-data`. | Standard |
| Naming | Plural nouns, kebab-case paths, camelCase JSON fields | Consistent and predictable |
| IDs | UUIDv7 strings. Reference numbers are accepted for lookup via `?ref=`. | ADR-021 |
| Timestamps | ISO 8601 in UTC (`2026-11-19T05:30:00.000Z`) | The client formats for Asia/Karachi |
| Pagination | Cursor-based: `?limit=20&cursor=<opaque>` → `{ data, nextCursor }` | Stable under inserts. No `OFFSET` scans. |
| Filtering | Query params: `status`, `categoryId`, `departmentId`, `priority`, `overdue`, `q`, `from`, `to` | Matches the brief's search and filter requirement (§4.1) |
| Sorting | `?sort=createdAt` or `?sort=-createdAt` (descending), allow-listed fields only | No sorting on unindexed or sensitive columns |
| Errors | RFC 9457 `application/problem+json` | One machine-readable error shape |
| Idempotency | `Idempotency-Key` header on `POST /complaints` (required) | Safe offline replays and double taps |
| Concurrency | `If-Match: "<version>"` on `PATCH` | Optimistic locking (ADR-010). 409 on mismatch. |
| Rate limits | `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After` headers. 429 when exceeded. | Clients can back off politely |
| Caching | `Cache-Control: private, no-store` on all authenticated responses | No shared cache ever stores personal data |

## 2. Error format

```json
{
  "type": "https://campusconnect.app/problems/forbidden",
  "title": "Access denied",
  "status": 403,
  "detail": "You do not have access to this complaint.",
  "instance": "/api/v1/complaints/0193f2a1-7c1e-7a51-9d40-1f3b2c8e4a10",
  "requestId": "req_01JD2Y8M3K"
}
```

| Status | When |
|---|---|
| 400 | Malformed JSON or failed Zod validation (an `errors` array names each field) |
| 401 | No valid session |
| 403 | Authenticated but not allowed (policy or scope). Audited. |
| 404 | The resource doesn't exist |
| 409 | Illegal state transition, stale version, or duplicate support |
| 413 / 415 | Upload too large / unsupported type |
| 422 | Valid shape but breaks a business rule (e.g. reopen window expired) |
| 429 | Rate limited |
| 500 | Unexpected. A generic message is returned, and details go to Sentry with the `requestId`. |

## 3. Endpoint catalogue

### 3.1 Auth (served by Better Auth at `/api/auth/*`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/sign-up/email` | Public | Student registration (domain allow-list, registration number) |
| POST | `/api/auth/sign-in/email` | Public | Log in (rate limited) |
| POST | `/api/auth/sign-out` | Signed in | Revoke the current session |
| GET | `/api/auth/verify-email?token=` | Public | Verify email |
| POST | `/api/auth/forget-password` · `/reset-password` | Public | Password reset flow |
| POST | `/api/auth/two-factor/*` | Admins | Enroll in and verify TOTP |
| GET | `/api/v1/me` | Signed in | Current user, role, department, notification preferences |

### 3.2 Reference data

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/v1/categories` | Signed in | Active categories with issue types (department **name** included for transparency, never chosen by the user) |
| GET | `/api/v1/departments` | Super Admin, Dept Admin (own) | Department list |

### 3.3 Complaints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/complaints` | Student | Create (auto-routed). Requires `Idempotency-Key`. |
| GET | `/api/v1/complaints` | All roles (scoped) | List with filters, search and cursor pagination |
| GET | `/api/v1/complaints/:id` | Scoped | Detail including timeline, public comments, attachment metadata |
| PATCH | `/api/v1/complaints/:id/status` | Dept Admin (dept), Super Admin | `{ to, note?, reason? }` with `If-Match` |
| PATCH | `/api/v1/complaints/:id/priority` | Dept Admin (dept), Super Admin | `{ priority }`. Recomputes `dueAt`. |
| POST | `/api/v1/complaints/:id/reassign` | Super Admin | `{ departmentId, reason }` |
| POST | `/api/v1/complaints/:id/withdraw` | Student (owner) | Only from `PENDING` |
| POST | `/api/v1/complaints/:id/reopen` | Student (owner) | Within 7 days of resolution, once |
| POST | `/api/v1/complaints/:id/rating` | Student (owner) | `{ rating: 1..5, comment? }` when `RESOLVED` |
| GET | `/api/v1/complaints/:id/comments` | Scoped | Students never receive `isInternal = true` |
| POST | `/api/v1/complaints/:id/comments` | Scoped | `{ body, isInternal? }`. `isInternal` is only honoured for staff. |
| POST | `/api/v1/complaints/:id/attachments` | Owner (open complaint), staff | Multipart upload, re-encoded server-side |
| GET | `/api/v1/attachments/:id` | Scoped via parent | 302 to a 5-minute presigned URL |
| GET | `/api/v1/complaints/similar?categoryId=&title=` | Student | Up to 5 similar open complaints (minimal projection) |
| POST | `/api/v1/complaints/:id/support` | Student | "Me too" (idempotent, one per user) |
| DELETE | `/api/v1/complaints/:id/support` | Student | Remove support |
| GET | `/api/v1/complaints/export.csv` | Dept Admin (dept), Super Admin | Current filters as CSV (formula-injection safe) |

### 3.4 Analytics

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | `/api/v1/analytics/summary` | Scoped | `{ total, pending, inProgress, resolved, rejected, withdrawn, overdue, avgResolutionHours, slaCompliance, avgRating }` |
| GET | `/api/v1/analytics/by-department` | Super Admin | `[{ department, total, pending, inProgress, resolved, rejected }]` (the brief's **bar chart**) |
| GET | `/api/v1/analytics/by-status` | Scoped | Status breakdown |
| GET | `/api/v1/analytics/trend?interval=week&from=&to=` | Scoped | Time series of created vs resolved |
| GET | `/api/v1/analytics/top-issues?limit=10` | Scoped | Most frequent issue types (recurring problems) |

### 3.5 Notifications

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/v1/notifications?unread=true` | Signed in | In-app notification feed |
| POST | `/api/v1/notifications/read` | Signed in | `{ ids }` or `{ all: true }` |
| POST | `/api/v1/push-subscriptions` | Signed in | Register this device for Web Push |
| DELETE | `/api/v1/push-subscriptions` | Signed in | Unregister (also done on logout) |
| PATCH | `/api/v1/me/preferences` | Signed in | `{ emailNotifications, pushNotifications }` |

### 3.6 Administration (Super Admin)

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/v1/admin/users` | List users, create department admin |
| PATCH | `/api/v1/admin/users/:id` | Activate or deactivate (revokes sessions), change department |
| GET / POST / PATCH | `/api/v1/admin/categories` | Manage categories, issue types and **routing** |
| GET / POST / PATCH | `/api/v1/admin/departments` | Manage departments |
| GET | `/api/v1/admin/audit-log` | Filter by actor, entity, outcome, date |
| POST | `/api/v1/admin/complaints/:id/reveal-identity` | Reveal an anonymous student's identity (reason required, audited) |

### 3.7 Operations

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness: `{ status: "ok", version }` |
| GET | `/api/health?deep=1` | Bearer `HEALTH_SECRET` | Database and storage reachability |
| GET | `/api/cron/sla` | Bearer `CRON_SECRET` | Hourly overdue notifications and escalation |
| GET | `/api/cron/deliveries` | Bearer `CRON_SECRET` | Every 5 min: retry push and email deliveries |
| GET | `/api/cron/cleanup` | Bearer `CRON_SECRET` | Daily: expired sessions, verification tokens, retention |

## 4. Examples

### 4.1 Create a complaint

```http
POST /api/v1/complaints
Idempotency-Key: 6f1c2b8e-3a51-4c0e-9f61-8f7a2d1b0c44
Content-Type: application/json

{
  "categoryId": "0193f1aa-0000-7000-8000-00000000c0de",
  "issueTypeId": "0193f1aa-0000-7000-8000-0000000017e1",
  "title": "Internet down in Lab 3",
  "description": "No computer in Lab 3 can reach the internet since 9 AM. Our practical is at 11.",
  "location": "Lab 3, Block B",
  "isAnonymous": false
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/complaints/0193f2a1-7c1e-7a51-9d40-1f3b2c8e4a10

{
  "id": "0193f2a1-7c1e-7a51-9d40-1f3b2c8e4a10",
  "referenceNo": "CC-2026-000123",
  "status": "PENDING",
  "priority": "MEDIUM",
  "department": { "code": "LAB_IT", "name": "Laboratory / IT Administration" },
  "dueAt": "2026-11-26T04:00:00.000Z",
  "createdAt": "2026-11-19T04:00:00.000Z",
  "version": 1
}
```

Any `departmentId`, `status` or `studentId` in the body is **stripped** by the Zod schema (mass-assignment protection). The department comes from the category (ADR-008). Replaying the same `Idempotency-Key` returns **200** with the same complaint instead of creating a duplicate.

### 4.2 Resolve a complaint

```http
PATCH /api/v1/complaints/0193f2a1-7c1e-7a51-9d40-1f3b2c8e4a10/status
If-Match: "2"
Content-Type: application/json

{ "to": "RESOLVED", "note": "Switch in Lab 3 replaced. All 40 PCs tested online at 10:40." }
```

Responses: `200` with the updated complaint (`version: 3`) · `403` if it's another department's complaint · `409` on a stale version or illegal transition · `400` if the note is shorter than 10 characters.

## 5. Server Actions (web UI)

Server Actions are **public HTTP endpoints** (anyone can POST to them), so each one follows the same template:

```ts
"use server";
export async function changeStatusAction(input: unknown) {
  const actor = await requireActor();                   // 1. session from DB (401 if none)
  const data = ChangeStatusSchema.parse(input);         // 2. Zod
  return complaintService.changeStatus(actor, data);    // 3. policy + scoped DAL inside
}
```

| Action | Service call |
|---|---|
| `submitComplaintAction` | `complaintService.create` |
| `changeStatusAction` | `complaintService.changeStatus` |
| `addCommentAction` | `complaintService.addComment` |
| `withdrawAction`, `reopenAction`, `rateAction` | `complaintService.*` |
| `uploadAttachmentAction` | `attachmentService.upload` |
| `markNotificationsReadAction` | `notificationService.markRead` |

## 6. API documentation

- `GET /api/v1/openapi.json` serves the OpenAPI 3.1 spec, generated at build time from the Zod schemas (`zod-to-openapi`). Only signed-in admins can read it in production.
- A Scalar or Swagger UI page at `/admin/api-docs` (Super Admin only) makes the API explorable, which is useful for the "explain your APIs" part of the evaluation and for future integrations.
