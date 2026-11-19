# 03 · Architecture Decision Records (ADRs)

> An ADR records **one significant decision**: the context, the decision, **why** it was made, which alternatives were rejected and why, and the consequences we accept.
> If a decision changes later, the old ADR is marked *Superseded* and a new one is added. Nothing is deleted, so the history explains itself.

| # | Decision | Status |
|---|---|---|
| 001 | Modular monolith, not microservices | Accepted |
| 002 | Next.js App Router + TypeScript as the full-stack framework | Accepted |
| 003 | PostgreSQL, not MongoDB | Accepted |
| 004 | Prisma as ORM and migration tool | Accepted |
| 005 | Vercel + Neon, co-located in Singapore | Accepted |
| 006 | Better Auth with database sessions | Accepted |
| 007 | Authorization in a scoped Data Access Layer. Proxy is not a security boundary. | Accepted |
| 008 | Category → department routing stored as data | Accepted |
| 009 | Explicit state machine + append-only event log | Accepted |
| 010 | Optimistic concurrency on complaint updates | Accepted |
| 011 | Server-side image re-encoding, private R2 bucket, short-lived signed URLs | Accepted |
| 012 | PWA with Serwist, with a deliberately limited offline scope | Accepted |
| 013 | Three notification channels with a delivery table and retries | Accepted |
| 014 | Distributed rate limiting with Upstash Redis | Accepted |
| 015 | PostgreSQL full-text search + pg_trgm, no search cluster | Accepted |
| 016 | Analytics from live SQL aggregates with a short cache | Accepted |
| 017 | Server Actions for the UI, versioned REST for the PWA and integrations, one service layer | Accepted |
| 018 | Tailwind v4 + shadcn/ui + Recharts | Accepted |
| 019 | Zod at every trust boundary | Accepted |
| 020 | Anonymous-to-department complaints | Accepted |
| 021 | UUIDv7 primary keys + human-readable reference numbers | Accepted |
| 022 | Portability: standard protocols behind adapters, Docker self-host path | Accepted |
| 023 | Observability: Sentry, structured logs, health checks, uptime monitoring | Accepted |
| 024 | CI/CD: GitHub Actions, preview deploys, Neon branch per PR, gated migrations | Accepted |

---

## ADR-001 · Modular monolith, not microservices

**Context.** A two-person team is building a single-domain system (complaints) for ~8,000 users and ~25 writes a day (see the [capacity estimate](01-product-and-requirements.md)).

**Decision.** Build **one deployable application** with strict internal module boundaries (`complaints`, `org`, `auth`, `notifications`, `attachments`, `analytics`, `audit`).

**Why.**
- Microservices solve **organizational** scaling (many teams shipping independently) and **uneven load** problems. We have neither.
- A complaint status change touches the complaint, its event, and a notification. In a monolith that is **one ACID transaction**. Across services it would need sagas or outbox events, with distributed failure modes.
- One deployment, one log stream and one database to back up. University IT can operate it.

**Alternatives rejected.**
- *Microservices (auth / complaints / notifications)*: network hops, distributed transactions, several deployments and more cost, with no benefit at this scale.
- *Unstructured monolith*: fast to start, but authorization logic would spread across pages and become impossible to audit.

**Consequences.** Module boundaries are enforced by folder structure and lint rules, not by the network. If one module ever needs independent scaling (e.g. notification fan-out), it can be pulled out because it already sits behind a service interface.

---

## ADR-002 · Next.js App Router + TypeScript as the full-stack framework

**Context.** We need a responsive web UI, an API, server-side authorization, a PWA, and a single codebase two developers can own.

**Decision.** **Next.js (App Router, current major: 16) with React 19 and TypeScript in `strict` mode**, running on the **Node.js runtime** (not Edge) for all data access.

**Why.**
- **One codebase, one deploy:** UI, REST API, Server Actions and cron handlers live together and share types. There is no CORS, no duplicated DTOs and no API/UI version drift.
- **Server Components** render data on the server: less JavaScript on students' phones, and data never passes through client code that could be tampered with.
- **Server-side authorization lives next to the data.** Pages fetch through the DAL on the server, so a hidden button never stands in for a permission check.
- First-class Vercel support, streaming, built-in image and font optimization, and the metadata/manifest APIs the PWA needs.
- **Node runtime** (not Edge), because Prisma, `sharp` (images) and `web-push` need Node APIs.

**Alternatives rejected.**
- *React SPA + Express/Nest API*: two deployments, CORS, duplicated types, and authorization logic split between client and server.
- *Laravel / Django*: mature, but the PWA and rich client interactivity would mean a second JavaScript toolchain, and the team's strength is TypeScript.
- *Remix / React Router v7*: comparable, but smaller ecosystem and less mature PWA tooling (Serwist targets Next.js).

**Consequences.** The App Router's caching model has to be understood: user-specific pages are always dynamic. Exact versions are pinned at scaffold time and Renovate opens PRs for updates.

---

## ADR-003 · PostgreSQL, not MongoDB

**Context.** The core data is users, departments, categories, complaints, events, comments, attachments and notifications, all of it related to everything else.

**Decision.** **PostgreSQL** as the single system of record.

**Why.**
1. **The data is relational.** A complaint belongs to a student, a category, a department, and has many events, comments and attachments. Foreign keys make orphaned or inconsistent records **impossible at the database level**, not just "avoided by careful code".
2. **Transactions across tables.** "Change status + write event + create notification" must be all-or-nothing. Postgres does this natively. MongoDB needs multi-document transactions on a replica set, which are slower and easy to get wrong.
3. **Analytics are SQL's home ground.** "Complaints per department per week", "median resolution hours" and "SLA compliance" are one `GROUP BY` / `percentile_cont` query each.
4. **Integrity rules live in the schema:** `CHECK (role <> 'DEPT_ADMIN' OR department_id IS NOT NULL)`, `CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)`, unique reference numbers.
5. **Built-in search** (`tsvector` full-text, `pg_trgm` similarity) covers search and duplicate detection without a second datastore.
6. Universally supported: every cloud, every university server, every backup tool.

**Alternatives rejected.**
- *MongoDB (Atlas)*: flexible schema is a **liability** here, because the schema is stable and integrity matters more. Joins become `$lookup` pipelines, and analytics become aggregation pipelines that are harder to review. Integrity rules would move into application code.
- *MySQL*: viable, but weaker on `CHECK` constraints historically, partial indexes, generated `tsvector` columns, `pg_trgm` and window functions.
- *Firebase / Firestore*: no relational integrity, security rules are a separate language, and analytics need an export to BigQuery.

**Consequences.** Schema changes need migrations, which we want anyway (ADR-004). **Deployment follows from this choice:** a managed Postgres with connection pooling (Neon, ADR-005), because serverless functions open many short-lived connections.

---

## ADR-004 · Prisma as ORM and migration tool

**Decision.** **Prisma ORM** for the schema, generated type-safe client and SQL migrations (`prisma migrate`). Raw SQL (`$queryRaw` with tagged templates, which are parameterized) is used only for analytics and full-text search.

**Why.**
- **The schema file is the documentation.** `schema.prisma` reads like an ERD, which helps the team, reviewers and judges.
- **Generated types** flow from the DB into services, so a renamed column breaks the build, not production.
- **Versioned SQL migrations** are committed to git and applied by CI (`prisma migrate deploy`).
- Parameterized queries by default, which removes SQL injection as a class of bug.
- Native support for Neon's serverless driver through driver adapters.

**Alternatives rejected.**
- *Drizzle ORM*: excellent and lighter, closer to SQL. A close second. Prisma won on schema readability and migration workflow maturity for this team.
- *Raw SQL / Kysely only*: maximum control, but more boilerplate and no schema-as-documentation.
- *TypeORM*: decorator-heavy, with a weaker type-safety track record.

**Consequences.** Some features (generated columns, `CHECK` constraints, `pg_trgm` indexes) are added with hand-edited SQL in migrations. That is supported and documented in [04](04-data-model.md).

---

## ADR-005 · Vercel + Neon, co-located in Singapore

**Context.** Users are in Pakistan. The app needs to be live, cheap to run, and easy to operate, and it uses PostgreSQL (ADR-003).

**Decision.**
- **App:** Vercel, functions pinned to region **`sin1` (Singapore)**.
- **Database:** **Neon serverless Postgres** in **`aws-ap-southeast-1` (Singapore)**, accessed through Neon's **pooled** connection string (PgBouncer) at runtime and the **direct** connection for migrations.
- **Plans:** Vercel **Pro** for production (Hobby is for non-commercial personal use only and limits cron frequency) and a **Neon paid plan** for point-in-time restore and no cold-start pauses on the production branch.

**Why.**
- **Co-location matters more than anything else for latency.** A page may run 3-5 queries. With the app and database in the same region each query takes about 1-2 ms, while across continents it takes about 150-250 ms. Singapore is the closest region both providers offer to Pakistan. Neither offers South Asia for both.
- **Serverless + pooling:** serverless functions scale out to many instances. Without PgBouncer they would exhaust Postgres connections. Neon's pooler handles thousands of client connections.
- **Neon branching:** every pull request gets a copy-on-write database branch, so tests and previews run against realistic data without touching production (ADR-024).
- **Zero server administration:** TLS, CDN, DDoS protection, OS patching and scaling are handled for us. The university doesn't have to staff a sysadmin.
- **Instant rollback:** Vercel keeps every deployment immutable, so rollback takes one click.

**Alternatives rejected.**
- *MongoDB Atlas + Render/Railway*: rejected with MongoDB (ADR-003).
- *Supabase*: a strong all-in-one option (Postgres, auth, storage). Rejected to avoid coupling auth and storage to one vendor. Its auth model (RLS + JWT) doesn't match our DAL-centric authorization.
- *Single VPS (Docker)*: cheapest at scale and the best fit for data sovereignty, but we would own patching, TLS, backups and uptime. It stays available as the self-hosted path (ADR-022).
- *AWS ECS/RDS*: production-grade but too much operations surface for a two-person team.

**Consequences.** Function execution limits apply, so long work goes to cron or background tasks. Data lives in Singapore. If university policy requires on-premises hosting, ADR-022 provides the migration path.

---

## ADR-006 · Better Auth with database sessions

**Decision.** **Better Auth** (TypeScript auth library, Prisma adapter) with:
- email and password, **mandatory email verification**, password reset;
- **database-backed sessions** in an httpOnly, `Secure`, `SameSite=Lax` cookie, 7-day sliding expiry and a 12-hour idle timeout for admins;
- **TOTP two-factor authentication required for every admin role**;
- passwords hashed with **scrypt** (the library default; memory-hard);
- a breached-password check (Have I Been Pwned k-anonymity range API) at registration and reset.

**Why.**
- **We don't write our own crypto or session handling.** Auth is where hand-rolled code fails security reviews.
- **Database sessions, not stateless JWTs:** an admin who leaves the university, or a stolen laptop, can be **revoked immediately** (`DELETE FROM session`). A JWT stays valid until it expires.
- The library runs **inside our app and our database**: no per-user pricing, and no student data sent to a third-party identity vendor.
- The plugin system covers 2FA, admin user management and OIDC SSO later, without changing libraries.

**Alternatives rejected.**
- *Auth.js (NextAuth)*: the credentials provider is deliberately limited (no built-in registration, verification or reset flows), and its JWT session default goes against revocability.
- *Clerk / Auth0*: excellent, but per-MAU pricing, student PII held by a third party, and vendor lock-in.
- *Hand-rolled auth*: unacceptable risk.

**Consequences.** Each authenticated request makes one session lookup (indexed by primary key, under 2 ms). We accept that cost for revocability.

---

## ADR-007 · Authorization in a scoped Data Access Layer. Proxy is not a security boundary.

**Context.** The brief's highlighted requirement: *"Role-based access must be enforced through server-side authorization… if a Library Administrator attempts to access a Laboratory/IT complaint through a direct URL, the system must deny access."*

**Decision.**
1. A **pure policy module** (`domain/policy.ts`) defines `can(actor, action, resource)` and `complaintScope(actor)`.
2. **Every** complaint query goes through a repository that **requires the actor** and **ANDs `complaintScope(actor)` into the SQL `WHERE` clause**.
3. Reading a resource outside your scope returns **403 Forbidden** (API) or an "Access denied" page (UI), and writes an `AuditLog` row with `outcome = DENIED`.
4. `proxy.ts` (Next.js middleware) only does **optimistic redirects** for UX (no cookie → `/login`). **It is never relied on for security.**

**Why.**
- **Defense in depth:** even if a page forgets a check, the repository can't return out-of-scope rows, because the scope is part of the query, not an `if` statement after it.
- **Proxy/middleware is not trustworthy as the only gate.** CVE-2025-29927 showed that Next.js middleware could be bypassed with a crafted header. Next.js's own guidance is to verify auth close to the data.
- **One place to test:** the policy is a pure function, so a test matrix covers every role × action × ownership combination.
- **403, not 404**, for valid-but-forbidden IDs: the brief asks to *deny*, and judges and admins should see an explicit denial. IDs are random UUIDv7s (ADR-021), so revealing that one exists leaks nothing useful. Every denial is audited.

**Alternatives rejected.**
- *Hiding UI elements only*: explicitly forbidden by the brief.
- *Checks only in middleware*: bypassable and coarse, since middleware has no knowledge of the resource's department.
- *PostgreSQL row-level security (RLS)*: strong, but awkward with pooled serverless connections (needs per-transaction `SET LOCAL` of the actor). Kept as a possible Phase 3 hardening layer, not the primary mechanism.

**Consequences.** Every service signature carries `actor`. This is slightly more verbose but self-documenting. See [05 · Security](05-security-and-access-control.md) for code.

---

## ADR-008 · Category → department routing stored as data

**Decision.** `Category.departmentId` is the routing table. On submission, the service reads the category and sets `Complaint.departmentId` **on the server**. The client **never sends a department**. If it sends one anyway, the Zod schema strips it.

**Why.**
- Routing is a **business rule the university will change** (new categories, departments merging). Data changes need no deploy.
- **Server-side derivation** makes routing tamper-proof: a student can't route a complaint to a department of their choosing by editing the request.
- Storing `departmentId` on the complaint (a snapshot), not only reading it through the category, means a later change to category routing doesn't silently move historical complaints. It also allows **reassignment** (FX-10) without changing the category, and makes the hot query `WHERE department_id = ?` a single indexed lookup.

**Alternatives rejected.** *A hard-coded `switch(category)`*: needs a deploy to change and is invisible to admins. *Keyword or AI routing*: unpredictable. Could be added later as a *suggestion* only.

---

## ADR-009 · Explicit state machine + append-only event log

**Decision.** Complaint status follows a **declared transition table** in `domain/state-machine.ts`:

`PENDING → IN_PROGRESS → RESOLVED | REJECTED`, plus `PENDING → REJECTED`, `PENDING → WITHDRAWN` (student), and `RESOLVED → IN_PROGRESS` (student reopen within 7 days).

Every change writes an immutable `ComplaintEvent` row (`from`, `to`, `actor`, `note`, `at`) in the **same transaction**.

**Why.**
- An explicit table makes **illegal transitions impossible** (e.g. `REJECTED → RESOLVED`) and testable as data.
- Business rules attach to transitions: *Rejected requires a reason*, *Resolved requires a resolution note*, *Reopen only within 7 days and only by the owner*.
- The event log gives the **student timeline**, the **audit trail** and the **analytics** (time-to-first-response, resolution duration) from one source.

**Alternatives rejected.** *Free-form status updates*: no integrity. *Full event sourcing*: overkill. We keep current state on the row **and** history in events, which is simpler to query.

---

## ADR-010 · Optimistic concurrency on complaint updates

**Decision.** `Complaint.version INT`. Updates run `UPDATE … WHERE id = ? AND version = ?` and increment it. Zero rows updated → **409 Conflict** → the UI shows "This complaint was updated by someone else. Reload to see changes."

**Why.** Departments have several staff. Without this, two admins acting at once means the last write silently wins, for example one resolves while another rejects. Optimistic locking needs no locks held across requests, which suits serverless.

---

## ADR-011 · Server-side image re-encoding, private R2 bucket, short-lived signed URLs

**Decision.**
1. The client compresses images (max 1600 px, ~80 % quality) **before upload**. That saves students' mobile data.
2. The upload goes to **our API** (≤ 4 MB per image, ≤ 3 per complaint), which:
   - checks the **magic bytes** (`file-type`), not the filename or the client's `Content-Type`;
   - **re-encodes with `sharp` to WebP**, which **strips EXIF (including GPS location)** and destroys polyglot or malicious payloads;
   - stores it in a **private** Cloudflare R2 bucket under a random key.
3. To view an image, `GET /api/v1/attachments/:id` runs the **same authorization as the parent complaint**, then redirects to a **presigned URL valid for 5 minutes**.

**Why.**
- Uploaded images are a classic attack vector (stored XSS via SVG, polyglots, decompression bombs). Re-encoding to a known-safe format removes the whole class. SVG is never accepted.
- Photos taken on phones embed GPS coordinates, which could de-anonymize an "anonymous" complainant. Stripping EXIF is a privacy requirement.
- A **private bucket + signed URLs** means an image link leaked in a screenshot expires within minutes, and image access follows complaint authorization.
- **R2:** S3-compatible API (portable to MinIO or AWS S3) and **no egress fees**, so image viewing never generates a surprise bill.

**Alternatives rejected.** *Direct-to-bucket presigned uploads*: no server-side inspection or re-encoding before storage. *Storing images in Postgres*: bloats backups and the database. *Vercel Blob*: workable, but proprietary API and egress costs.

**Consequences.** Upload size is bounded by the function body limit (~4.5 MB), which client-side compression keeps us well under.

---

## ADR-012 · PWA with Serwist, with a deliberately limited offline scope

**Decision.** Make CampusConnect an **installable PWA** using **Serwist** (the maintained successor of `next-pwa`, built on Workbox) and a typed `app/manifest.ts`. Offline support is **scoped on purpose**:

| Works offline | Requires network |
|---|---|
| App shell and navigation | Login and registration |
| Student's last-viewed complaint list and details | All admin actions (status changes, replies) |
| **Writing a new complaint**: saved to IndexedDB, auto-submitted when back online | Analytics dashboards |
| Offline fallback page for anything uncached | Image viewing beyond what's cached |

**Why.**
- Students use phones on patchy campus Wi-Fi. Losing a typed complaint is the worst UX failure.
- **Admin actions are online-only** on purpose: offline admin writes could conflict (two staff, ADR-010) and replay stale decisions. Admin pages are **never cached** (they contain many students' data).
- Offline submissions carry an **Idempotency-Key**, so a retried sync never creates duplicates.
- **On logout, the service worker deletes all runtime caches and IndexedDB data**, which matters for students using shared lab computers.
- Serwist provides precaching of hashed build assets, runtime caching strategies, navigation preload and Background Sync with a fallback, which hand-writing a service worker would get wrong.

**Alternatives rejected.** *Native apps (React Native / Flutter)*: two more codebases, app-store review and installation friction, for no feature we need. *Capacitor wrapper*: possible later if store presence is required. *Full offline-first sync (CRDTs, PouchDB)*: far more complexity than the use case justifies.

**Consequences.** Background Sync isn't supported in Safari/iOS, so the app also retries the queue on `online` events and on app start. iOS Web Push requires the app to be **installed to the home screen** (iOS 16.4+). The UI explains this. Details in [07](07-pwa-and-mobile.md).

---

## ADR-013 · Three notification channels with a delivery table and retries

**Decision.** A domain event (e.g. `STATUS_CHANGED`) creates, **in the same transaction**, one `Notification` (in-app, always) and one `NotificationDelivery` row per external channel (`PUSH`, `EMAIL`) with `status = PENDING`. After the response is sent, `after()` (Next.js) dispatches them. A cron job (`/api/cron/deliveries`, every 5 minutes) retries failures with exponential backoff for up to 5 attempts.

**Why.**
- **The transactional outbox pattern:** a notification is never lost because the email API was briefly down, and never sent for a change that rolled back.
- **In-app** is the source of truth, **push** is instant and free, and **email** is the reliable fallback for students who didn't install the PWA.
- Students control preferences (push and email toggles). Security emails (verification, reset) can't be disabled.

**Alternatives rejected.** *Sending inline in the request*: slow and loses messages on failure. *A queue service (SQS, QStash)*: unnecessary at ~250 events/day, since a table plus cron is enough. It can be swapped in behind the same interface.

---

## ADR-014 · Distributed rate limiting with Upstash Redis

**Decision.** `@upstash/ratelimit` (sliding window) over Upstash Redis (HTTP, serverless-friendly).

| Endpoint | Limit | Key |
|---|---|---|
| Login | 5 / 15 min | IP + email |
| Register | 3 / hour | IP |
| Password reset request | 3 / hour | email |
| Create complaint | 10 / day | user |
| Upload image | 30 / hour | user |
| Comment | 30 / hour | user |
| Any `/api/v1` | 120 / min | user or IP |

**Why.** Serverless functions don't share memory, so an in-process counter would reset on every cold start and be split across instances. Redis gives one shared counter. Limits stop credential stuffing, spam complaints and storage abuse.

**Alternatives rejected.** *In-memory*: ineffective on serverless. *Postgres counters*: puts write load on the primary for every request. *Vercel WAF only*: coarse (by IP), not by user or action. Used **in addition**.

---

## ADR-015 · PostgreSQL full-text search + pg_trgm, no search cluster

**Decision.** A generated `tsvector` column on `Complaint` (title weighted A, description B, reference number) with a **GIN index**, plus a **`pg_trgm` GIN index on the title** for fuzzy matching and the "similar complaints" suggestion (FX-07).

**Why.** Under 100k complaints over the system's life, Postgres search returns in milliseconds. Elasticsearch or Meilisearch would add a second datastore to sync, secure, back up and pay for, with no measurable benefit. Search queries go **through the scoped DAL**, so search can't leak other departments' data. A separate search index would need its own copy of the authorization rules.

---

## ADR-016 · Analytics from live SQL aggregates with a short cache

**Decision.** Dashboard numbers come from indexed aggregate queries through the scoped DAL, cached for **60 seconds per scope** (`all` / `dept:<id>`) in each server instance.

**Why.** At this data volume the aggregates take milliseconds. A warehouse or ETL pipeline would add latency (stale data) and cost. Because analytics go through the same DAL, **a department admin's charts can't include other departments' numbers**. The 60-second cache protects the database from dashboards left on auto-refresh.

**Future.** If volume grows 100×, add a materialized view refreshed by cron, behind the same service function.

---

## ADR-017 · Server Actions for the UI, versioned REST for the PWA and integrations, one service layer

**Decision.**
- **UI mutations** (forms) use **Server Actions**: progressive enhancement, built-in CSRF protection (origin check), less client code.
- A **versioned REST API** (`/api/v1/*`) exposes the same use cases for the **service worker's offline sync**, a future native or partner client, and an **OpenAPI spec** (generated from Zod) that documents the system.
- **Both call the same service functions.** No business logic lives in either adapter.

**Why.** Server Actions give the best web UX with the least code, but they aren't a public, stable or documented contract, and a service worker can't call them reliably. REST is the stable contract. Sharing services means **one** authorization path. See [06](06-api-design.md).

**Alternatives rejected.** *REST only with client fetch*: more client JS, and loading and error state by hand everywhere. *tRPC*: TypeScript-only clients, not a public contract. *GraphQL*: query flexibility we don't need, and harder to authorize field by field.

---

## ADR-018 · Tailwind v4 + shadcn/ui + Recharts

**Decision.** Tailwind CSS v4 (design tokens as CSS variables), **shadcn/ui** components (copied into our repo, built on **Radix UI** primitives) and **Recharts** for charts.

**Why.**
- **Radix** gives correct accessibility (focus management, ARIA, keyboard support) for dialogs, menus and selects, which are the hardest parts to get right.
- **shadcn/ui is source code we own**, not a dependency. We can restyle freely and nothing breaks on upgrades.
- **Tailwind tokens** keep light and dark themes consistent and make the mobile-first responsive work fast.
- **Recharts** is SVG, so charts are crisp on every screen, respond to the theme, and are accessible with labels.

**Alternatives rejected.** *MUI*: heavy runtime CSS-in-JS and a recognizable "template" look. *Chart.js*: canvas-based, harder to make accessible and theme-aware.

---

## ADR-019 · Zod at every trust boundary

**Decision.** Every input crossing a trust boundary is parsed with **Zod**: form data, JSON bodies, query strings, route params, environment variables, webhook payloads and IndexedDB drafts before sync.

**Why.** TypeScript types disappear at runtime. Zod makes "the type says it's a UUID" actually true. One schema gives the **validator, the TypeScript type and the OpenAPI schema**, so they can't drift. Unknown keys are **stripped**, which is how a client-supplied `departmentId` or `status` is dropped on creation (mass-assignment protection).

---

## ADR-020 · Anonymous-to-department complaints

**Decision.** The student may tick **"Hide my identity from the department"**. The complaint still belongs to the student (so they can track it). The **DAL projection** for department admins replaces the student's name, email and registration number with `"Anonymous student"`. **Only the Super Admin** can see the identity, and every reveal is audited.

**Why.** Teaching complaints are the most sensitive in the brief (late teachers, poor explanations). A student fears grade retaliation. Fully anonymous complaints can't be followed up or protected against spam. This middle path keeps **accountability** (the Super Admin can act on abuse) and **safety** (departments can't retaliate).

**Consequences.** Masking happens **in the repository's select projection**, not in the UI, so identity fields never reach a department admin's browser, not even in JSON. Attachments are EXIF-stripped (ADR-011) for the same reason.

---

## ADR-021 · UUIDv7 primary keys + human-readable reference numbers

**Decision.** Primary keys are **UUIDv7** (time-ordered, 74 random bits). Each complaint also gets a **reference number** `CC-<year>-<6-digit sequence>` from a Postgres sequence, shown to humans and searchable.

**Why.**
- **UUIDs in URLs** can't be enumerated (`/complaints/1`, `/complaints/2`, …). That is defense in depth on top of authorization.
- **v7, not v4:** time ordering keeps B-tree inserts sequential (better index locality) and gives a natural sort order.
- **Reference numbers** are for people ("my complaint is CC-2026-000123"). Sequences are gap-tolerant and concurrency-safe.

---

## ADR-022 · Portability: standard protocols behind adapters, Docker self-host path

**Decision.** Every managed service is accessed through a **standard protocol** behind an internal interface:

| Interface | Cloud (default) | Self-hosted (university servers) |
|---|---|---|
| Database | Neon Postgres | PostgreSQL 16+ container or VM |
| `StorageService` (S3 API) | Cloudflare R2 | MinIO |
| `Mailer` | Resend (HTTP) | University SMTP relay |
| `RateLimiter` | Upstash Redis | Redis / Valkey container |
| Cron | Vercel Cron | system cron / container scheduler calling the same `/api/cron/*` endpoints with the shared secret |

Next.js builds with `output: "standalone"`, so the same codebase ships as a **Docker image** (non-root, multi-stage) with a `docker-compose.yml` for the self-hosted stack.

**Why.** Universities often have data-sovereignty policies or later decide to bring systems in-house. This makes "move off Vercel" a configuration change, not a rewrite, and means the vendors behind ADR-005 never lock us in.

---

## ADR-023 · Observability: Sentry, structured logs, health checks, uptime monitoring

**Decision.**
- **Sentry** for errors (server, client and service worker) and performance traces, with PII scrubbing on (no request bodies).
- **pino** structured JSON logs (`requestId`, `actorId`, `route`, `durationMs`, `outcome`) shipped through a Vercel log drain.
- **`GET /api/health`** for liveness, and **`/api/health?deep=1`** (secret-protected) to check the database and storage.
- An **external uptime monitor** (e.g. Better Stack or UptimeRobot) checks every minute and alerts the team by email or Telegram.

**Why.** Production failures are discovered by users or by monitoring. We choose monitoring. Structured logs make "why did student X's complaint fail?" a filter query rather than guesswork.

---

## ADR-024 · CI/CD: GitHub Actions, preview deploys, Neon branch per PR, gated migrations

**Decision.**
1. **Every PR:** lint → typecheck → unit tests → integration tests (real Postgres) → build → Playwright E2E against a **Vercel preview** backed by a **Neon branch** created for that PR (deleted when the PR closes).
2. **Merge to `main`:** CI runs `prisma migrate deploy` against production **first**, using the direct (non-pooled) URL, then promotes the Vercel production deployment.
3. Migrations follow **expand → migrate → contract**: never drop or rename in the same release that stops using a column, so a rollback of the app never meets an incompatible schema.
4. Branch protection: PR review required, CI must pass, no direct pushes to `main`.

**Why.** Testing against a **real copy of the database** catches migration and query bugs that mocks hide. Gating migrations before the deploy means the new code never runs against an old schema. Expand/contract keeps Vercel's one-click rollback safe.

See [09 · Deployment & Operations](09-deployment-and-operations.md).
