# CampusConnect

Smart Campus Complaint and Feedback Management System. Students report campus issues, the system routes each one to the right department automatically, staff resolve them, and management watches trends. It works on the web and installs on phones and desktops as a PWA.

**Status:** architecture and system design complete. Implementation starts with Phase 0 (see [docs/11-delivery-roadmap.md](docs/11-delivery-roadmap.md)).

## Documentation

Start at **[docs/README.md](docs/README.md)**. For a single visual page with all diagrams rendered, open **[docs/site/index.html](docs/site/index.html)** in a browser.

| Area | Document |
|---|---|
| Requirements | [docs/01-product-and-requirements.md](docs/01-product-and-requirements.md) |
| Architecture | [docs/02-system-architecture.md](docs/02-system-architecture.md) |
| Decisions (ADRs) | [docs/03-architecture-decisions.md](docs/03-architecture-decisions.md) |
| Data model | [docs/04-data-model.md](docs/04-data-model.md) |
| Security | [docs/05-security-and-access-control.md](docs/05-security-and-access-control.md) |
| API | [docs/06-api-design.md](docs/06-api-design.md) |
| PWA and mobile | [docs/07-pwa-and-mobile.md](docs/07-pwa-and-mobile.md) |
| Workflows | [docs/08-core-workflows.md](docs/08-core-workflows.md) |
| Deployment and operations | [docs/09-deployment-and-operations.md](docs/09-deployment-and-operations.md) |
| Standards and testing | [docs/10-engineering-standards-and-testing.md](docs/10-engineering-standards-and-testing.md) |
| Roadmap and risks | [docs/11-delivery-roadmap.md](docs/11-delivery-roadmap.md) |

Regenerate the visual page after editing any document:

```bash
node scripts/build-docs.mjs
```

## Planned stack

Next.js (App Router) · React 19 · TypeScript · PostgreSQL (Neon) · Prisma · Better Auth · Tailwind CSS v4 · shadcn/ui · Recharts · Serwist (PWA) · Cloudflare R2 · Upstash Redis · Resend · Sentry · Vercel · GitHub Actions

## Team

- Sudais Khalid
- Farooq Khan
