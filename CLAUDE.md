# __APP_NAME__

TypeScript monorepo (npm workspaces): `apps/server` (Hono + Drizzle + Postgres), `apps/web` (Next.js App Router + Tailwind + TanStack Query). The two apps are independent and share no code or packages. The app runs on the host (`npm run dev`: API on `API_PORT` (3001), web on `WEB_PORT` (3000); both set in `.env`); infrastructure runs in Docker (`make up`): Postgres (pgvector/pgvector:pg17), Redis, Mailpit, pgAdmin, Dozzle. `make help` lists commands.

## Working agreement
- Work is driven by plans in `docs/plans/` (see its README). Execute one plan per session; don't wander beyond its Scope.
- When a plan is finished, tick its tasks, fill in its Outcome and update the index.
- `docs/architecture.md` is **binding for all new code**. Check its ADRs before changing the data model or layering. Rules you must not break:
  - Layering (server): route → service → repository. Routes never touch the DB; services never import Drizzle or Hono; Drizzle is used only inside repositories, which return domain types.
  - Server: Zod schemas live next to the module (`<feature>.schemas.ts`) and are the source of truth for DTOs; infer types from them. Request validation is declared in the route's `request` (query, params, body); failures answer 422 through the shared `validationHook`.
  - The apps share no code. The web app keeps its own hand-written API types in `apps/web/src/types.ts`; when an API response changes, update them in the same change.
  - No `process.env` outside `apps/server/src/config.ts`.
  - Every endpoint is documented in OpenAPI in the same change, derived from its Zod schemas via `createRoute` (see "API documentation" in `docs/architecture.md`). Swagger UI is at `/docs` on the API port. An endpoint without `tags`, `summary`, and every response status it can return is not finished.
  - Logging: pino JSON; every line carries `requestId` automatically. Add domain IDs only (`{ itemId }`), never log secrets. Never use `console.log`.
  - Services throw `DomainError` subclasses; the global error handler shapes the response. Error body is always `{ code, message, details?, requestId }`. Validation errors are 422.
  - Slow or heavy work (rendering, transcoding, imports) never runs inside a request handler: queue it as a job (BullMQ on Redis) through `JobQueuePort`, never by importing `bullmq` in a service. Handlers in `jobs/handlers.ts` stay thin (one service call). The requestId travels with the job automatically; see "Long-running work" in `docs/architecture.md` for how to add a job.
  - Outgoing email goes through Mailpit in dev (SMTP_HOST/SMTP_PORT); never hard-code a mail host.
  - External systems and command-line tools (FFmpeg, etc.) sit behind an interface in a small adapter, so services stay testable.
  - List endpoints return `PaginatedResponse<T>`.
  - No `any`; one class per file; kebab-case file names with a role suffix (`items.service.ts`).
  - Web: data via TanStack Query with loading, error and empty states; show 422 `details` on the matching form field.
- Server is ESM: relative imports use `.js` suffixes.
  - Web: the API is `apps/server` only. Do not add Next API routes (`route.ts`) or server actions; the browser calls same-origin `/api/*`, which `next.config.ts` forwards to the API. Pages are client-rendered with TanStack Query; use server components only for static layout.
- Schema-first: the Zod schema is the single source of truth for validation, types and docs. Import `z` from `@hono/zod-openapi`, not `zod`.
- Every change ships with tests (`apps/server/test`, Vitest; they use in-memory Postgres via PGlite, so no Docker is needed to run them). Before finishing: `npm run typecheck && npm test`.
- After changing `.env`, use `make restart s=<service>` (plain `docker compose restart` does not reload it).
- Schema changes: edit `apps/server/src/db/schema.ts`, run `npm run db:generate`, commit the generated migration. Migrations apply on server start.
