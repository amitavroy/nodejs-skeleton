# Architecture

## Overview
- `apps/server`: NestJS 11 API (Express platform) on Node, Postgres via Drizzle (node-postgres). CommonJS, compiled with SWC (`nest start --watch` in dev, `nest build` → `dist/`).
- `apps/web`: Next.js (App Router) + Tailwind v4 + TanStack Query. It only renders UI: `next.config.ts` rewrites `/api/*` to the NestJS server, so the browser stays same-origin and there is no CORS. `scripts/next.mjs` loads the root `.env` and sets the port from `WEB_PORT`.
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
- **Enforcement:** `DomainError` carries its `httpStatus` (default 422); the global `AllExceptionsFilter` (`core/all-exceptions.filter.ts`) writes it. Malformed JSON is answered with 400 by the JSON parser in `core/request-id.middleware.ts` (Nest's own body parser is turned off).

### ADR-004: Next.js is UI only; NestJS is the single API
- **Status:** accepted
- **Decision:** the web app is Next.js, but all API logic stays in `apps/server`. Next proxies `/api/*` to it.
- **Consequences:** one place for business rules, validation and tests. Heavy or long-running work (rendering, transcoding) never lives in Next, which keeps the server free to run queues and workers. If server rendering with API data is needed later, call the API from server components rather than duplicating logic.

### ADR-005: NestJS is the API framework
- **Status:** accepted (plan 0002)
- **Decision:** `apps/server` is NestJS 11 on Express. Flow is controller → service → repository, wired by Nest DI. Interfaces are used **only for third-party integrations** (`integrations/<name>/`): interface + DI token + implementations + one module that chooses the binding. Validation and OpenAPI stay schema-first with Zod via `nestjs-zod` + `@nestjs/swagger`. Jobs stay on BullMQ.
- **Why:** its modules, DI and testing module give a familiar structure and easy test overrides.
- **Consequences:** DI needs decorator metadata, so the server is CommonJS and built/tested with SWC (`unplugin-swc` in Vitest); `tsc` only type-checks. The HTTP contract (paths, bodies, status codes, error shape, `X-Request-ID`, `/docs`, `/docs-json`, `/admin/queues`) is independent of the framework, so the web app is unaffected by server internals.

### ADR-006: shadcn/ui for all web UI; page components colocated in `_components/`
- **Status:** accepted
- **Decision:** the web app's UI is built from shadcn/ui components (Radix primitives + Tailwind, copied into the repo by the shadcn CLI). Components that belong to one page sit next to it in a private `_components/` folder inside that route's folder.
- **Why:** one consistent, accessible component set that we own and can edit, with no runtime component-library dependency. Colocation keeps everything a page needs in one folder; Next.js treats `_folder` as private and opts it and its subfolders out of routing, so these files never become URL segments.
- **Consequences:** new UI starts with `npx shadcn@latest add <component>`; hand-rolled equivalents of shadcn components and other UI libraries are not accepted. A component moves from `_components/` to `src/components/` only when a second route needs it.

## Server guidelines
### Layering
| Layer | Does | Must not |
| --- | --- | --- |
| Controller | Take Zod DTOs (validated by the global pipe), call one service method, return the result; Swagger decorators | Hold business logic, touch the DB |
| Service | Business logic; calls repositories and injected integrations | Import Drizzle, Express, `bullmq` or `process.env` (use `APP_CONFIG`) |
| Repository | All Drizzle queries (inject `DB`); returns domain types | Leak table rows or ORM types upward |
| Integration | Wraps a third-party system or CLI tool behind an interface + token | Contain business rules |
| Job handler | Thin: call a service method | Contain business logic |

### Folder structure
```
apps/server/src/
  main.ts              bootstrap: load config + logger, NestFactory, configureApp, listen
  app.module.ts        AppModule.forRoot({ config, logger, jobs }); jobs: false (tests) needs no Redis
  configure-app.ts     request-id/JSON middleware, Bull Board, `api` prefix, Zod pipe, filter, Swagger (shared with tests)
  config.ts            the only reader of process.env (+ loads the repo-root .env); provided as APP_CONFIG
  core/                CoreModule (APP_CONFIG, LOGGER), request-id middleware, AllExceptionsFilter, PinoNestLogger
  common/              errors, logger, log-file, request-context, pagination, api-error/paginated schemas, Swagger helpers
  db/                  schema.ts, client.ts (DB token), DatabaseModule (migrations on start, pool closed on shutdown)
  health/              HealthController; checks injected via HEALTH_CHECKS
  modules/<feature>/   <feature>.module.ts, .controller.ts, .service.ts, .repository.ts, .schemas.ts
  integrations/<name>/ <name>.interface.ts (interface + token), implementations, <name>.module.ts (the one binding)
    job-queue/         JobQueue / JOB_QUEUE → BullMqJobQueue
    mail/              MailSender / MAIL_SENDER → SmtpMailSender | LogMailSender, chosen by MAIL_DRIVER
  jobs/                JobsModule + JobsWorker (BullMQ Worker), job-handlers.ts, process-job.ts, bull-board.ts
```

### How to add an integration
The mail integration is the worked example. For a new third-party system (S3, payments, ...):
1. `integrations/<name>/<name>.interface.ts`: the interface (only what services need) and its token, e.g. `export const MAIL_SENDER = Symbol("MAIL_SENDER")`.
2. One class per implementation (`smtp-mail-sender.ts`, `log-mail-sender.ts`), taking what it needs from `AppConfig` in its constructor.
3. `<name>.module.ts` (`@Global()`): the **only** place the implementation is chosen, like Laravel's `bind()`:
   ```ts
   { provide: MAIL_SENDER, inject: [APP_CONFIG, LOGGER],
     useFactory: (c: AppConfig, log: Logger) => c.MAIL_DRIVER === "log" ? new LogMailSender(log) : new SmtpMailSender(c) }
   ```
   Add the driver setting to `config.ts` and `.env.example`; import the module in `AppModule`.
4. Use it anywhere: `constructor(@Inject(MAIL_SENDER) private readonly mailer: MailSender) {}`.
5. Test with a fake: `createTestApp()` overrides the token (`.overrideProvider(MAIL_SENDER).useValue(new FakeMailSender())`), and a small test checks the module binds the right class per driver (`test/jobs.test.ts`).

Adding another provider later (SES, Mailchimp) is one class plus one case in that factory; nothing that injects the token changes.

### Observability
- Pino JSON logs (`common/logger.ts`); level from `LOG_LEVEL`. Output goes to stdout, or, when `LOGS_AS_FILE=true`, to one file per day, `storage/logs/YYYY-MM-DD.log` at the repo root (`common/log-file.ts`; local-time date, appended across restarts, never deleted automatically, so rotate or prune them outside the app). The two modes are exclusive: a file means nothing on stdout. In containers or on a platform that collects stdout, keep `false`. Every log line carries `requestId`, plus domain IDs where known (`itemId`, `jobId`, ...).
- `requestId` is the `X-Request-ID` request header (if present and at most 128 chars) or a generated UUID. It is returned in the `X-Request-ID` response header, included in every error body, and kept in `AsyncLocalStorage` (`common/request-context.ts`), so services log it without passing it around. The web app's `/api` proxy forwards the header untouched.
- Each request ends with one `request completed` line (method, path, status, `responseTimeMs`). Unhandled exceptions are logged at `error` with the cause; the client only sees a generic 500.
- When a request enqueues a job, copy `getRequestId()` into the job data; the worker restores it with `runWithRequestId` before calling the service. Job failure logs say whether the job `will_retry` or is a `final_failure`, with the attempt number. This is built in `jobs/process-job.ts` and `jobs/jobs-worker.ts`; `test/jobs.test.ts` proves a request's ID shows up in the worker's logs.

### API contract
- Zod schemas are the source of truth for request and response shapes; DTOs are `createZodDto(schema)` and the OpenAPI document is generated from them. The web app keeps its own mirrored types in `apps/web/src/types.ts`; API changes update both sides.

### API documentation (Swagger / OpenAPI)
**Every endpoint, new or changed, must be documented in the same piece of work.** An endpoint without docs is not finished.

- **Where:** Swagger UI at `/docs`, raw OpenAPI JSON at `/docs-json` (set up in `configure-app.ts` with `@nestjs/swagger` and nestjs-zod's `cleanupOpenApiDoc`). Every controller method is picked up automatically.
- **Single source of truth:** schemas live in `<feature>.schemas.ts`; types are `z.infer` of them; DTO classes are `createZodDto(schema)`, and the same DTOs validate the request (global `ZodValidationPipe`) and describe it. Import `z` from `zod`. Name reusable schemas with `.meta({ id: "Name" })` and add `example`/`description` in `.meta()` where they help.
- **Required on every endpoint:** `@ApiTags` on the controller (the module name), `@ApiOperation({ summary })` (one line, including notable defaults and limits), DTO-typed `@Body()`/`@Query()`/`@Param()` (defaults, enums and bounds come through from the schema), and a response decorator for the success status and for every error it can return (422 invalid input, 404 not found, ...), with the error `code` in the description. Use `@ZodResponse({ status, type })` for JSON bodies (it also serializes the result through the schema), `@ApiResponse` for empty ones (204), and `ApiErrorResponse`/`ApiValidationErrorResponse` from `common/api-responses.ts` for errors. Use `paginatedSchema(item, "Name")` for lists.
- **Conventions to reflect in the docs:** dates are ISO 8601 strings; list endpoints return `PaginatedResponse<T>`; errors are `{ code, message, details?, requestId }`.
- **Checklist when adding or changing an endpoint:** (1) Zod request and response schemas; (2) controller method with `@ApiOperation` and a response decorator per status; (3) open `/docs` (or fetch `/docs-json`) and confirm the route, parameters, body and every response status appear; (4) update the web app's `src/types.ts`.
- **Reviewing:** a change that adds or alters an endpoint without matching docs is incomplete. `test/observability.test.ts` pins the list of documented paths, so adding a route forces you to update it and look at the docs.

### Long-running work
Anything slow runs as a job, never inside a request. BullMQ on Redis, behind the `JobQueue` integration so services stay testable.
- **Enqueue:** a service injects `@Inject(JOB_QUEUE) jobs: JobQueue` and calls `jobs.enqueue("job-name", payload)` (`integrations/job-queue/job-queue.interface.ts`). `BullMqJobQueue` copies the current `requestId` into the job data. Never import `bullmq` in a service.
- **Process:** `JobsWorker` (`jobs/jobs-worker.ts`, a BullMQ `Worker` started on application bootstrap and closed on shutdown) runs each job through `processJob`, which restores the `requestId`, then calls a handler from `jobs/job-handlers.ts`, which calls one service method. Handlers contain no business logic. Completion and failures are logged with the original `requestId`.
- **Defaults** (`integrations/job-queue/queue.ts`): 3 attempts with exponential backoff, keeps the last 100 completed and 500 failed jobs. The queue fails fast (the request gets a 500) when Redis is down.
- **Add a job:** (1) add its name and payload to `JobPayloads`; (2) add a service method that does the work; (3) register a handler in `createJobHandlers` (pass the service in from `JobsWorker` if it is a new one, and import its module in `JobsModule`); (4) call `enqueue` from the service; (5) test with `FakeJobQueue` and by calling the handler directly (see `test/jobs.test.ts`).
- **Dashboard:** Bull Board at `/admin/queues` on the API port, behind basic auth (`BULL_BOARD_USER`, `BULL_BOARD_PASSWORD`; change the defaults outside local development). It is not part of the OpenAPI docs. It is mounted directly on Express in `configureApp` (`jobs/bull-board.ts`). To show a new queue there, add it to `bullBoard.queues` in `main.ts`.
- The worker runs in the API process for now. To scale it out, add a second entry point whose module imports `JobsModule` but serves no HTTP (`NestFactory.createApplicationContext`), and start the API with `jobs` but without `JobsModule`.
- For long jobs the API returns a job id and the UI polls for progress (not built yet).

### Testing
Test through the real app: `createTestApp(overrides)` (`test/test-app.ts`) builds `AppModule.forRoot({ jobs: false })` with `Test.createTestingModule`, overrides `DB` (PGlite, in memory), `JOB_QUEUE` (`FakeJobQueue`), `MAIL_SENDER` (`FakeMailSender`) and `HEALTH_CHECKS` with `overrideProvider`, runs `configureApp` and returns a supertest client (`http.get(...)`), the Nest app (`app.get(ItemsService)`) and the fakes. Apps are closed after each test. Unit-test services with a fake repository when logic is non-trivial. Test integrations against small fixtures, and their module's binding per driver.

## Web guidelines
### Components (ADR-006)
- **shadcn/ui is mandatory.** Add primitives with `npx shadcn@latest add <component>` (run in `apps/web`); they land in `src/components/ui/` and are ours to adjust. Never hand-roll what shadcn provides (button, input, table, dialog, form, select, ...), and don't add another component library. Use shadcn's Form + Zod pattern for forms and its Table (or Data Table) for lists.
- **Colocate page components** in a private `_components/` folder in the route's folder. The `_` prefix opts the folder out of routing, so it never becomes a URL segment:
  ```
  src/app/
    items/
      page.tsx              thin: composes the page from its components
      _components/
        items-table.tsx     used only by this page
        items-form.tsx
  src/components/
    ui/                     shadcn primitives (generated by the CLI)
    <shared>.tsx            only components used by more than one route
  ```
- `page.tsx` stays thin. A component moves to `src/components/` only when a second route needs it.

### Data
- Data loaded with TanStack Query; every list has loading, error and empty states.
- Forms show server 422 `details` next to the matching field.
- API calls go through `src/api.ts` only; types come from `src/types.ts`.
- No Next API routes or server actions: business logic and data access live in `apps/server` (ADR-004).
- Components that fetch data are client components (`"use client"`).
