# Architecture

## Overview
- `apps/server`: Hono API on Node, Postgres via Drizzle (node-postgres). Started with `tsx`, no build step.
- `apps/web`: React + Vite + Tailwind v4 + TanStack Query. In dev, Vite proxies `/api` to the server.
- `packages/shared`: Zod schemas and inferred types, imported by both apps as TypeScript source.
- The app runs on the host. `docker-compose.yml` runs the infrastructure: Postgres (`pgvector/pgvector:pg17`, with the `vector` extension enabled), Redis (`redis:7-alpine`, for queues), Mailpit (dev mail catcher), pgAdmin (preconfigured via `docker/pgadmin/servers.json`) and Dozzle (container logs). Manage them with `make`.

## Architectural decisions
Add one ADR per decision that is costly to reverse. Status: proposed | accepted | superseded by ADR-NNN.

### ADR-001: Single TypeScript monorepo with npm workspaces
- **Status:** accepted
- **Decision:** one language and one repo for API, UI and shared types. npm workspaces, no extra tooling.
- **Consequences:** API types are shared with the UI without codegen. Fewer moving parts; a switch to pnpm or Turborepo is possible later without code changes.

### ADR-002: Postgres with Drizzle, migrations on start
- **Status:** accepted
- **Decision:** Postgres (pgvector image, so embeddings are available when needed) through Drizzle ORM. Migrations are generated with drizzle-kit, committed, and applied when the server starts.
- **Consequences:** needs `make up` before running the server. Tests use PGlite (in-memory Postgres), so they need no Docker; avoid Postgres extensions in tests. Repositories depend on the `Db` type, not on a driver.

### ADR-003: Error responses and status codes
- **Status:** accepted
- **Decision:** every error body is `{ code, message, details?, requestId }`.
  - **422:** well-formed request with invalid values (Zod validation, business-rule violations). `details` lists `{ path, message }` per field.
  - **404:** a named resource does not exist.
  - **400:** a request that cannot be understood at all (e.g. malformed JSON).
  - **500:** anything unexpected; generic message, cause logged with the `requestId`.
  - 401, 403, 409 and 429 are added when auth, conflicts or rate limits arrive.
- **Enforcement:** `DomainError` carries its `httpStatus` (default 422); the global handler in `app.ts` writes it.

## Server guidelines
### Layering
| Layer | Does | Must not |
| --- | --- | --- |
| Route | Validate input with Zod, call one service method, return the result | Hold business logic, touch the DB |
| Service | Business logic; calls repositories and adapters | Import Drizzle, Hono or `process.env` |
| Repository | All queries; returns domain types | Leak table rows or ORM types upward |
| Adapter | Wraps an external system or CLI tool behind an interface | Contain business rules |
| Job handler | Thin: call a service method | Contain business logic |

### Folder structure
```
apps/server/src/
  modules/<feature>/   <feature>.routes.ts, .service.ts, .repository.ts
  adapters/            implementations of external-system interfaces
  common/              errors, validation helper, shared types
  db/                  schema.ts, client.ts
  config.ts            the only reader of process.env
  app.ts               composition root (wiring)
  main.ts              process entry
```

### Long-running work
Anything slow runs as a job, never inside a request. Use BullMQ on Redis. The route enqueues a job and returns its id; a worker process runs thin handlers that call services; the UI polls (or subscribes) for progress. Not wired up in the template yet: add it with the first feature that needs it.

### Testing
Test through the app with `app.request(...)` against an in-memory database (`createDb(":memory:")`). Unit-test services with a fake repository when logic is non-trivial. Test adapters against small fixtures.

## Web guidelines
- Data loaded with TanStack Query; every list has loading, error and empty states.
- Forms show server 422 `details` next to the matching field.
- API calls go through `src/api.ts` only; types come from `@app/shared`.
