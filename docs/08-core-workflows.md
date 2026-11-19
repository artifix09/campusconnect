# 08 · Core Workflows

> Step-by-step behaviour of the main use cases as sequence diagrams, showing **where each rule is enforced**. Authorization details are in [05](05-security-and-access-control.md) and the offline draft flow is in [07](07-pwa-and-mobile.md) §4.

## 1. Student registration and email verification (FR-01)

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as Register page
    participant AUTH as Better Auth (/api/auth)
    participant RL as Rate limiter
    participant DB as PostgreSQL
    participant M as Resend (email)

    S->>UI: name, university email, registration no, password
    UI->>AUTH: POST /sign-up/email
    AUTH->>RL: register limit by IP (3 per hour)
    AUTH->>AUTH: Zod: email domain allow-list, reg no format, password >= 10 chars
    AUTH->>AUTH: breached-password check (HIBP k-anonymity, first 5 hash chars only)
    AUTH->>DB: INSERT user (role STUDENT, emailVerified false) + account (scrypt hash)
    AUTH->>DB: INSERT verification token (24 h, single use)
    AUTH->>M: send verification email
    AUTH-->>UI: 200 "Check your inbox"
    S->>AUTH: click link GET /verify-email?token=...
    AUTH->>DB: mark emailVerified, delete token, create session
    AUTH-->>S: redirect to /student (logged in)
```

Notes: if the email is already registered, the response is **the same** "Check your inbox" message, and the existing owner gets a "someone tried to register with your email" mail instead. This prevents account enumeration.

## 2. Login, including admin 2FA

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant AUTH as Better Auth
    participant DB as PostgreSQL

    U->>AUTH: email + password
    AUTH->>AUTH: rate limit 5 per 15 min per IP+email
    AUTH->>DB: load user + hash, verify scrypt (constant time)
    alt invalid
        AUTH-->>U: 401 "Invalid email or password"
    else role is DEPT_ADMIN or SUPER_ADMIN
        AUTH-->>U: 2FA challenge
        U->>AUTH: 6-digit TOTP code (or backup code)
        AUTH->>DB: verify TOTP, create session (12 h idle)
        AUTH-->>U: Set-Cookie __Secure-session, redirect /admin
    else student
        AUTH->>DB: create session (7 d sliding)
        AUTH-->>U: Set-Cookie, redirect /student
    end
```

## 3. Submit a complaint with automatic routing (FR-02, FR-03)

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant UI as New complaint form
    participant ACT as submitComplaintAction
    participant SVC as complaintService.create
    participant DB as PostgreSQL (one transaction)
    participant BG as after() background
    participant N as Notifications

    S->>UI: picks category "Laboratories & IT", issue "Internet connectivity"
    UI->>UI: as title is typed, show similar open complaints (Me too option)
    S->>UI: Submit
    UI->>ACT: form data + idempotencyKey
    ACT->>ACT: requireActor() gives STUDENT, emailVerified true
    ACT->>ACT: Zod parse (unknown keys such as departmentId stripped)
    ACT->>SVC: create(actor, data)
    SVC->>SVC: rate limit 10 per day per student
    SVC->>DB: BEGIN
    SVC->>DB: SELECT department_id FROM category WHERE id = categoryId AND is_active
    Note over SVC,DB: ROUTING: department derived on the server (LAB_IT)
    SVC->>DB: INSERT complaint (status PENDING, priority MEDIUM, dueAt now + 7d, referenceNo from sequence)
    SVC->>DB: INSERT complaint_event CREATED
    SVC->>DB: INSERT notification for each active LAB_IT admin + delivery rows
    SVC->>DB: COMMIT
    SVC-->>ACT: { id, referenceNo CC-2026-000123 }
    ACT-->>UI: redirect to complaint page, toast "Submitted to Laboratory / IT Administration"
    SVC->>BG: dispatch deliveries after the response
    BG->>N: push + email to LAB_IT admins
```

Images are uploaded right after creation (one request per image, see §4), so a slow photo upload never blocks the complaint itself.

## 4. Image upload pipeline (ADR-011)

```mermaid
sequenceDiagram
    autonumber
    participant C as Browser
    participant API as POST /complaints/:id/attachments
    participant SVC as attachmentService
    participant R2 as Cloudflare R2 (private)
    participant DB as PostgreSQL

    C->>C: compress to max 1600 px (browser-image-compression)
    C->>API: multipart image (<= 4 MB)
    API->>SVC: upload(actor, complaintId, file)
    SVC->>DB: findComplaintForActor (scope check) + count attachments < 3
    SVC->>SVC: magic bytes check (JPEG / PNG / WebP / HEIC), pixel limit
    SVC->>SVC: sharp: rotate by EXIF, resize, encode WebP, strip ALL metadata
    SVC->>R2: PUT complaints/{complaintId}/{uuid}.webp
    SVC->>DB: INSERT attachment + event ATTACHMENT_ADDED
    API-->>C: 201 { id, width, height }
    Note over C,API: Viewing: GET /attachments/:id runs the same scope check then 302 to a 5 minute signed URL
```

## 5. Department admin processes a complaint (FR-06, FR-07)

```mermaid
sequenceDiagram
    autonumber
    actor A as Lab/IT Admin
    participant UI as Admin complaint page
    participant SVC as complaintService.changeStatus
    participant SM as State machine (domain)
    participant DB as PostgreSQL
    participant N as Notifications
    actor S as Student

    A->>UI: open queue (filter Pending, sorted by due date)
    UI->>SVC: list(actor) scoped to department_id = LAB_IT
    A->>UI: open CC-2026-000123, click "Start work"
    UI->>SVC: changeStatus(actor, id, to IN_PROGRESS, version 1)
    SVC->>DB: findComplaintForActor (scope)
    SVC->>SM: canTransition(PENDING to IN_PROGRESS, actor DEPT_ADMIN)
    SM-->>SVC: allowed
    SVC->>DB: UPDATE ... SET status, first_response_at, version 2 WHERE id AND version 1
    SVC->>DB: INSERT event STATUS_CHANGED + notification for student
    SVC-->>UI: updated (version 2)
    N-->>S: push "Your complaint CC-2026-000123 is now In progress"
    A->>UI: later: Resolve with note "Switch replaced, 40 PCs online"
    UI->>SVC: changeStatus(to RESOLVED, note, version 2)
    SVC->>SM: allowed (note >= 10 chars)
    SVC->>DB: UPDATE status RESOLVED, resolved_at, version 3 + event + notification
    N-->>S: push "Resolved. Tap to rate the response"
```

**Conflict case:** if a second Lab/IT admin had rejected it in the meantime, the `UPDATE ... WHERE version = 2` matches 0 rows, the service returns **409**, and the UI says *"This complaint was updated by someone else. Reload to see the latest."*

## 6. Student reopens or rates (FX-08)

```mermaid
flowchart TD
    R["Complaint RESOLVED"] --> Q{"Student satisfied?"}
    Q -->|Yes| RATE["Rate 1 to 5 (+ optional comment)<br/>event RATED, feeds CSAT metric"]
    Q -->|No, within 7 days| RO["Reopen with reason<br/>RESOLVED to IN_PROGRESS<br/>event REOPENED, dept notified, reopen_count + 1"]
    Q -->|No, after 7 days| NEW["Reopen disabled<br/>Prompt: file a new complaint (links the old reference)"]
    RO --> R2["Dept works again, resolves"]
    R2 --> Q2{"Second resolution"}
    Q2 --> RATE
```

Reopen is allowed **once**. A second dispute escalates to the Super Admin as a flagged complaint, which keeps a complaint from bouncing back and forth forever.

## 7. SLA monitoring and escalation (FX-06)

```mermaid
sequenceDiagram
    autonumber
    participant CRON as Vercel Cron (hourly)
    participant API as /api/cron/sla
    participant DB as PostgreSQL
    participant N as Notifications

    CRON->>API: GET with Authorization Bearer CRON_SECRET
    API->>API: verify secret (else 401)
    API->>DB: SELECT open complaints WHERE due_at < now() (partial index)
    loop each newly overdue complaint
        API->>N: notify department admins "Overdue: CC-2026-000123"
    end
    API->>DB: SELECT open complaints WHERE due_at < now() - 24h AND not escalated
    loop each
        API->>N: notify Super Admin "Escalated: overdue by more than 24 h"
        API->>DB: INSERT event (metadata escalated true)
    end
```

The job is **idempotent**: it records what it has already notified in event metadata, so running it twice (retries, manual trigger) never double-notifies.

## 8. Super Admin oversight (FR-09, FR-11, FR-12)

```mermaid
flowchart LR
    SA["Super Admin dashboard"] --> K["KPI tiles<br/>Total, Pending, In progress,<br/>Resolved, Rejected, Overdue"]
    SA --> B["Bar chart<br/>complaints by department"]
    SA --> T["Trend line<br/>created vs resolved per week"]
    SA --> L["All complaints table<br/>search q, filter category,<br/>department, status, priority, date"]
    L --> D["Complaint detail<br/>timeline, comments, internal notes"]
    D --> RA["Reassign department<br/>(reason required, audited)"]
    D --> RV["Reveal anonymous identity<br/>(reason required, audited)"]
    SA --> X["Export CSV of current filter"]
    SA --> M["Manage admins, categories,<br/>routing, departments"]
    SA --> AU["Audit log<br/>incl. denied access attempts"]
```

## 9. Complaint conversation (FX-04)

- The student and department exchange **public comments**. Each one notifies the other side.
- Staff can add **internal notes** (`isInternal = true`). These are filtered out **in the repository query** for student actors, so they never reach the student's browser.
- Comments are plain text (max 2,000 characters), rendered with React's automatic escaping. Links are auto-detected and rendered with `rel="noopener noreferrer nofollow"`.
