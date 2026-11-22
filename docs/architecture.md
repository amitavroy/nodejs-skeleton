# Architecture

## Overview
- `apps/server`: Hono API on Node, Postgres via Drizzle (node-postgres). Started with `tsx`, no build step.
- `apps/web`: Next.js (App Router) + Tailwind v4 + TanStack Query. It only renders UI: `next.config.ts` rewrites `/api/*` to the Hono server, so the browser stays same-origin and there is no CORS. `scripts/next.mjs` loads the root `.env` and sets the port from `WEB_PORT`.
- The two apps are independent: they share no code or packages and talk only over HTTP. The web app mirrors the API's types by hand in `src/types.ts`.
- The app runs on the host. `docker-compose.yml` runs the infrastructure: Postgres (`pgvector/pgvector:pg17`, with the `vector` extension enabled), Redis (`redis:7-alpine`, for queues), Mailpit (dev mail catcher), pgAdmin (preconfigured via `docker/pgadmin/servers.json`) and Dozzle (container logs). Manage them with `make`.

## Architectural decisions
Add one ADR per decision that is costly to reverse. Status: proposed | accepted | superseded by ADR-NNN.

### ADR-001: Single TypeScript monorepo with npm workspaces
- **Status:** accepted
- **Decision:** one repo and one language for API and UI, installed together with npm workspaces (one lockfile, one `npm install`). No code is shared between the apps.
- **Consequences:** the web app's API types are written by hand and must be updated when the API changes (add OpenAPI-generated types later if this becomes painful). Each app can be moved to its own repo without code changes.

### ADR-002: Postgres with Drizzle, migrations on start
- **Status:** accepted
- **Decision:** Postgres (pgvector image, so embeddings are available when needed) through Drizzle ORM. Migrations are generated with drizzle-kit, committed, and applied when the server starts.
- **Consequences:** needs `make up` before running the server. Tests use PGlite (in-memory Postgres), so they need no Docker; avoid Postgres extensions in tests. Repositories depend on the `Db` type, not on a driver.

### ADR-003: Error responses and status codes
- **Status:** accepted
- **Decision:** every error body is `{ code, message, details?, requestId }`.
  - **422:** well-formed request with invalid values (Zod validation, business-rule violations). `details` lists `{ path, message }` per field.
  - **404:** a named resource does not exist.
  - **400:** a request that cannot be understood at all (e.g. malformed JSON); code `HTTP_400`, raised by the framework, not by a `DomainError`.
  - **500:** anything unexpected; generic message, cause logged with the `requestId`.
  - 401, 403, 409 and 429 are added when auth, conflicts or rate limits arrive.
- **Enforcement:** `DomainError` carries its `httpStatus` (default 422); the global handler in `app.ts` writes it.

### ADR-004: Next.js is UI only; Hono is the single API
- **Status:** accepted
- **Decision:** the web app is Next.js, but all API logic stays in `apps/server`. Next proxies `/api/*` to it.
- **Consequences:** one place for business rules, validation and tests. Heavy or long-running work (rendering, transcoding) never lives in Next, which keeps the server free to run queues and workers. If server rendering with API data is needed later, call Hono from server components rather than duplicating logic.

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
  ports/               interfaces for external systems (e.g. `job-queue.port.ts`)
  adapters/            implementations of ports (e.g. `bullmq-job-queue.adapter.ts`)
  jobs/                queue setup, worker, handlers (thin: one service call each)
  services.ts          wires repositories → services (shared by the HTTP app and the worker)
  common/              errors, request-context, logger, validation hook, openapi helpers, pagination
  db/                  schema.ts, client.ts
  config.ts            the only reader of process.env
  app.ts               composition root (wiring)
  main.ts              process entry
```

### Observability
- Pino JSON logs (`common/logger.ts`); level from `LOG_LEVEL`. Every log line carries `requestId`, plus domain IDs where known (`itemId`, `jobId`, ...).
- `requestId` is the `X-Request-ID` request header (if present and at most 128 chars) or a generated UUID. It is returned in the `X-Request-ID` response header, included in every error body, and kept in `AsyncLocalStorage` (`common/request-context.ts`), so services log it without passing it around. The web app's `/api` proxy forwards the header untouched.
- Each request ends with one `request completed` line (method, path, status, `responseTimeMs`). Unhandled exceptions are logged at `error` with the cause; the client only sees a generic 500.
- When a request enqueues a job, copy `getRequestId()` into the job data; the worker restores it with `runWithRequestId` before calling the service. Job failure logs say whether the job `will_retry` or is a `final_failure`, with the attempt number. This is built in `jobs/worker.ts`; `test/jobs.test.ts` proves a request's ID shows up in the worker's logs.

### API contract
- Zod schemas are the source of truth for request and response shapes; the OpenAPI document is generated from them. The web app keeps its own mirrored types in `apps/web/src/types.ts`; API changes update both sides.

### API documentation (Swagger / OpenAPI)
**Every endpoint, new or changed, must be documented in the same piece of work.** An endpoint without docs is not finished.

- **Where:** Swagger UI at `/docs`, raw OpenAPI JSON at `/docs-json` (set up in `app.ts` with `@hono/zod-openapi` and `@hono/swagger-ui`). Routes are picked up automatically when defined with `createRoute` and registered with `.openapi(route, handler)`.
- **Single source of truth:** schemas live in `<feature>.schemas.ts`; types are `z.infer` of them; the same schemas validate the request and describe it. Import `z` from `@hono/zod-openapi`. Name reusable schemas with `.openapi("Name")` and add `example`/`description` where they help.
- **Required on every route:** `tags` (the module name), `summary` (one line, including notable defaults and limits), `request` (query, params, body: defaults, enums and bounds come through from the schema), and a `responses` entry for the success status and for every error the route can return (422 invalid input, 404 not found, ...), with the error `code` in the description. Use the helpers in `common/openapi.ts` (`jsonResponse`, `errorResponse`, `validationErrorResponse`) and `paginatedSchema(item, "Name")` for lists.
- **Conventions to reflect in the docs:** dates are ISO 8601 strings; list endpoints return `PaginatedResponse<T>`; errors are `{ code, message, details?, requestId }`.
- **Checklist when adding or changing an endpoint:** (1) Zod request and response schemas; (2) `createRoute` with tags, summary and all responses; (3) open `/docs` (or fetch `/docs-json`) and confirm the route, parameters, body and every response status appear; (4) update the web app's `src/types.ts`.
- **Reviewing:** a change that adds or alters an endpoint without matching docs is incomplete. `test/observability.test.ts` pins the list of documented paths, so adding a route forces you to update it and look at the docs.

### Long-running work
Anything slow runs as a job, never inside a request. BullMQ on Redis, behind a port so services stay testable.
- **Enqueue:** a service calls `jobQueue.enqueue("job-name", payload)` (`ports/job-queue.port.ts`). The BullMQ adapter copies the current `requestId` into the job data. Never import `bullmq` in a service.
- **Process:** `jobs/worker.ts` restores the `requestId`, then calls a handler from `jobs/handlers.ts`, which calls one service method. Handlers contain no business logic.
- **Defaults** (`jobs/queue.ts`): 3 attempts with exponential backoff, keeps the last 100 completed and 500 failed jobs. The queue fails fast (the request gets a 500) when Redis is down.
- **Add a job:** (1) add its name and payload to `JobPayloads`; (2) add a service method that does the work; (3) register a handler in `createJobHandlers`; (4) call `enqueue` from the service; (5) test with `FakeJobQueue`.
- **Dashboard:** Bull Board at `/admin/queues` on the API port, behind basic auth (`BULL_BOARD_USER`, `BULL_BOARD_PASSWORD`; change the defaults outside local development). It is not part of the OpenAPI docs. To show a new queue there, add it to `bullBoard.queues` in `main.ts`.
- The worker runs in the API process for now (`main.ts`). To scale it out, move the `startWorker` block into its own entry file.
- For long jobs the API returns a job id and the UI polls for progress (not built yet).

### Testing
Test through the app with `app.request(...)` against an in-memory database (`createDb(":memory:")`). Unit-test services with a fake repository when logic is non-trivial. Test adapters against small fixtures.

## Web guidelines
- Data loaded with TanStack Query; every list has loading, error and empty states.
- Forms show server 422 `details` next to the matching field.
- API calls go through `src/api.ts` only; types come from `src/types.ts`.
- No Next API routes or server actions: business logic and data access live in `apps/server` (ADR-004).
- Components that fetch data are client components (`"use client"`).
