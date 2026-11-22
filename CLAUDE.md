# __APP_NAME__

TypeScript monorepo (npm workspaces): `apps/server` (Hono + Drizzle + Postgres), `apps/web` (React + Vite + Tailwind + TanStack Query), `packages/shared` (Zod schemas and types shared by both). The app runs on the host (`npm run dev`: server :3001, web :5173, `/api` proxied); infrastructure runs in Docker (`make up`): Postgres (pgvector/pgvector:pg17), Redis, Mailpit, pgAdmin, Dozzle. `make help` lists commands.

## Working agreement
- Work is driven by plans in `docs/plans/` (see its README). Execute one plan per session; don't wander beyond its Scope.
- When a plan is finished, tick its tasks, fill in its Outcome and update the index.
- `docs/architecture.md` is **binding for all new code**. Check its ADRs before changing the data model or layering. Rules you must not break:
  - Layering (server): route → service → repository. Routes never touch the DB; services never import Drizzle or Hono; Drizzle is used only inside repositories, which return domain types.
  - Zod schemas live in `packages/shared` and are the single source of truth for DTOs; infer types from them. Validate every request with `validate(...)`.
  - No `process.env` outside `apps/server/src/config.ts`.
  - Services throw `DomainError` subclasses; the global error handler shapes the response. Error body is always `{ code, message, details?, requestId }`. Validation errors are 422.
  - Slow or heavy work (rendering, transcoding, imports) never runs inside a request handler: queue it as a job (BullMQ on Redis) and report progress.
  - Outgoing email goes through Mailpit in dev (SMTP_HOST/SMTP_PORT); never hard-code a mail host.
  - External systems and command-line tools (FFmpeg, etc.) sit behind an interface in a small adapter, so services stay testable.
  - List endpoints return `PaginatedResponse<T>`.
  - No `any`; one class per file; kebab-case file names with a role suffix (`items.service.ts`).
  - Web: data via TanStack Query with loading, error and empty states; show 422 `details` on the matching form field.
- Server is ESM: relative imports use `.js` suffixes.
- Every change ships with tests (`apps/server/test`, Vitest; they use in-memory Postgres via PGlite, so no Docker is needed to run them). Before finishing: `npm run typecheck && npm test`.
- After changing `.env`, use `make restart s=<service>` (plain `docker compose restart` does not reload it).
- Schema changes: edit `apps/server/src/db/schema.ts`, run `npm run db:generate`, commit the generated migration. Migrations apply on server start.
