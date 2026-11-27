# 0002 – Migrate apps/server to NestJS

- **Status:** done (archived)
- **Depends on:** none

## Tasks
Vertical slices: each task delivers something working end to end, not a horizontal layer. Tick `[x]` as each one is finished and verified.

- [x] 1. Nest skeleton boots – `/api/health`, `/docs`, request-id middleware, exceptions filter
- [x] 2. Items CRUD on Nest – controller/service/repository with Zod DTOs and Swagger
- [x] 3. Jobs + Bull Board – job-queue integration, @nestjs/bullmq processor, Bull Board behind basic auth
- [x] 4. Mail integration – MailSender interface, SMTP impl, single binding by MAIL_DRIVER, used by the item-added job
- [x] 5. Tests ported – every existing assertion kept, plus a mail test
- [x] 6. Docs and rules updated – CLAUDE.md, architecture.md (ADR-005), README, .env.example

## Context
The user always intended the backend to be **NestJS**. The template was built on a different HTTP framework from the first commit, and `CLAUDE.md`/`docs/architecture.md` (ADR-004) documented it, so every later session kept building on it. The server is still small: one `items` module, health, BullMQ jobs, pino + requestId, Swagger, Bull Board. That makes this the cheapest moment to switch.

At the same time, the architecture becomes **simple by default** instead of hexagonal everywhere:
- **Flow:** route → controller → service → repository. Repositories own all Drizzle queries and return typed domain objects.
- **Interfaces only for third-party integrations** (mail, job queue, later S3, payment, ...). Each integration has an interface, a DI token, one or more implementations, and **exactly one place where the binding is chosen** (Laravel `bind()` equivalent):
  ```ts
  // integrations/mail/mail.module.ts: the ONLY binding place
  { provide: MAIL_SENDER, useFactory: (c: AppConfig) => c.MAIL_DRIVER === "ses" ? new SesMailSender(c) : new SmtpMailSender(c), inject: [APP_CONFIG] }
  // anywhere
  constructor(@Inject(MAIL_SENDER) private readonly mailer: MailSender) {}
  // tests
  .overrideProvider(MAIL_SENDER).useValue(new FakeMailSender())
  ```

**The external contract stays identical**: paths, bodies, status codes, the error shape `{ code, message, details?, requestId }`, the `X-Request-ID` header, `/docs`, `/docs-json` and `/admin/queues`. So `apps/web` needs no changes.

## Process (per CLAUDE.md working agreement)
1. Create `docs/plans/0002-migrate-server-to-nestjs.md` from `_template.md` containing this plan (tasks first), and add it to the index in `docs/plans/README.md`.
2. Execute it, ticking tasks as they're done, then fill in the Outcome and set the status to done.

## Key technical decisions
- **NestJS 11 on the Express platform** (default; works with `@bull-board/express` and `supertest`).
- **SWC for build/run/test.** NestJS DI needs `emitDecoratorMetadata`, which esbuild (`tsx`, plain Vitest) does not emit. So:
  - dev: `nest start --watch -b swc`
  - start: `node dist/main.js` after `nest build -b swc`, or `nest start -b swc`
  - Vitest: `unplugin-swc` in `vitest.config.ts`
  - typecheck: still `tsc --noEmit`
- **CommonJS for apps/server** (`"type": "commonjs"` in `apps/server/package.json`; server tsconfig overrides `module`/`moduleResolution` to `nodenext`, plus `experimentalDecorators`, `emitDecoratorMetadata`, and `verbatimModuleSyntax: false`). This is Nest's default and the most trouble-free with SWC. The ".js suffix" rule in CLAUDE.md is dropped. Replace `import.meta.dirname`/`import.meta.url` with `__dirname` (`common/logger.ts`, `db/client.ts`).
- **Validation and docs stay schema-first with Zod** via `nestjs-zod`:
  - `createZodDto(schema)` for body, query and params DTOs
  - global `ZodValidationPipe`
  - `@nestjs/swagger` + `cleanupOpenApiDoc`, with `@ApiTags`, `@ApiOperation({ summary })` and `@ApiResponse`/`@ZodResponse` for every status
  - `z` is imported from `zod`
  - the `id` path param uses a Zod DTO (not `ParseIntPipe`), so bad ids stay 422 rather than 400
- **Config:** keep `config.ts` (Zod env schema, still the only `process.env` reader). Add `MAIL_DRIVER` (`smtp` for now). Load `.env` with `process.loadEnvFile` inside `config.ts` when the file exists, replacing tsx's `--env-file-if-exists`. Expose it as an `APP_CONFIG` provider in a global `CoreModule`.
- **Logging:**
  - keep `common/logger.ts`, `common/log-file.ts` and `common/request-context.ts` (AsyncLocalStorage) unchanged in behaviour
  - pino is provided via a `LOGGER` token
  - a small `PinoNestLogger implements LoggerService` makes Nest's own bootstrap logs JSON too
  - a `RequestIdMiddleware` (applied to `*`) resolves and echoes `X-Request-ID`, wraps `next()` in `runWithRequestId`, and logs `request completed` on `res.on("finish")`
- **Errors:** one global `AllExceptionsFilter` (`APP_FILTER`) reproduces ADR-003:
  - `DomainError` → its `httpStatus`
  - `ZodValidationException` → 422 `VALIDATION_ERROR` with `details`
  - `NotFoundException` for an unknown route → 404 `NOT_FOUND`
  - other `HttpException` → `HTTP_<status>`; keep the `www-authenticate` header
  - anything else → logged, 500 `INTERNAL_ERROR`
  - malformed JSON must still be 400 `HTTP_400`. Verify with the existing test; if body-parser errors bypass the filter, disable the built-in parser (`bodyParser: false`) and register `express.json()` behind a wrapper that turns its error into `BadRequestException`.
- **Jobs:** `@nestjs/bullmq`.
  - `JobsModule` registers the `app-jobs` queue with the current defaults (3 attempts, exponential backoff, removeOnComplete 100 / removeOnFail 500, `enableOfflineQueue: false`)
  - `JobsProcessor extends WorkerHost` restores the requestId through the existing `processJob`, logs `will_retry`/`final_failure` via the existing `failureOutcome` (`@OnWorkerEvent`), and calls thin handlers (one service call each)
  - the job queue becomes an integration: `JobQueue` interface + `JOB_QUEUE` token + `BullMqJobQueue` (uses `@InjectQueue`, copies the requestId)
- **Bull Board:** `@bull-board/nestjs` + `@bull-board/express` at `/admin/queues`, with a small hand-written basic-auth middleware (`BULL_BOARD_USER`/`PASSWORD`). It is excluded from Swagger.
- **App assembly shared by `main.ts` and tests:**
  - `AppModule.forRoot({ jobs: boolean })`: `jobs: false` leaves out the BullMQ connection, worker and Bull Board, so tests need no Redis
  - `configureApp(app)` sets the global `api` prefix (excluding `docs`, `docs-json`, `admin/*`), the logger, the filter/pipe and Swagger
- **Health:** a `HealthController` with checks injected through a `HEALTH_CHECKS` token (Postgres `select 1`, Redis ping); tests override it.
- **DB:** global `DatabaseModule` provides `DB` (via `createDb(config)`, migrations on start). It closes the pool in `onApplicationShutdown`. Tests override `DB` with `createTestDb()` (PGlite). `app.enableShutdownHooks()` replaces the hand-written SIGINT/SIGTERM handler.

## Target structure (apps/server/src)
```
main.ts                     bootstrap: loadConfig, logger, NestFactory, configureApp, listen
app.module.ts               AppModule.forRoot({ jobs })
configure-app.ts            prefix, filter, pipe, swagger: shared with tests
config.ts                   only process.env reader (+ .env loading)
core/                       core.module.ts (APP_CONFIG, LOGGER), request-id.middleware.ts,
                            all-exceptions.filter.ts, pino-nest-logger.ts
common/                     errors.ts, logger.ts, log-file.ts, request-context.ts, pagination.ts,
                            api-error.schema.ts, paginated-response.schema.ts (Zod, from "zod")
db/                         schema.ts, client.ts, database.module.ts (DB token)
health/                     health.controller.ts, health.module.ts
modules/items/              items.module.ts, items.controller.ts, items.service.ts,
                            items.repository.ts, items.schemas.ts (Zod + DTOs)
integrations/               one folder per external system: interface + token + impls + module
  job-queue/                job-queue.interface.ts (JobQueue, JobPayloads, JOB_QUEUE),
                            bullmq-job-queue.ts, job-queue.module.ts
  mail/                     mail-sender.interface.ts (MailSender, MAIL_SENDER),
                            smtp-mail-sender.ts (nodemailer → Mailpit), mail.module.ts (binding by MAIL_DRIVER)
jobs/                       jobs.module.ts, jobs.processor.ts, job-handlers.ts, worker-utils.ts
                            (processJob, failureOutcome), bull-board.ts (module + basic auth)
```
Removed: `app.ts`, `services.ts`, `ports/`, `adapters/`, `admin/`, `common/app-env.ts`, `common/validation-hook.ts`, `common/openapi.ts`, and every dependency of the previous framework (including its Zod-OpenAPI, Swagger UI and Bull Board adapters).

Rules for one class per file and kebab-case names still apply. Suffixes: `.controller.ts`, `.service.ts`, `.repository.ts`, `.module.ts`, `.interface.ts`.

## Mail example (the worked "bind an interface" case)
- `MailSender { send({ to, subject, text }): Promise<void> }`; `SmtpMailSender` uses nodemailer with `SMTP_HOST`/`SMTP_PORT`/`MAIL_FROM` (Mailpit in dev).
- `MailModule` is the only place `MAIL_DRIVER` is read to choose the implementation. Adding SES or Mailchimp later = one class + one line in that factory.
- To show the binding being used: `ItemsService.handleAdded` (job, not request) sends an "Item added" mail to `MAIL_FROM` through the injected `MailSender`.
- Tests: `FakeMailSender` records the mails; a test asserts that the job sends one.

## Task details
1. **Nest skeleton boots:**
   - deps: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/swagger`, `nestjs-zod`, `reflect-metadata`, `rxjs`
   - dev deps: `@nestjs/cli`, `@nestjs/testing`, `@swc/core`, `@swc/cli`, `unplugin-swc`, `supertest`
   - also: `nest-cli.json`, `.swcrc`, `vitest.config.ts`, tsconfig/CJS changes
   - Core and Database modules, `configureApp`, health endpoint, request-id middleware, exceptions filter, Swagger at `/docs` + `/docs-json`
   - Done when `npm run dev -w @app/server` serves `/api/health` and `/docs`.
2. **Items CRUD on Nest:** controller/service/repository/module with Zod DTOs and full Swagger responses. Repository code is reused almost unchanged. Done when the items tests pass via supertest.
3. **Jobs + Bull Board:** job-queue integration, `@nestjs/bullmq` processor with requestId restore and failure logging, Bull Board behind basic auth, `AppModule.forRoot({ jobs })`. Done when the jobs tests pass and, with `make up`, creating an item logs `item added` from the worker with the same requestId.
4. **Mail integration:** interface, token, SMTP implementation, `MailModule` binding by `MAIL_DRIVER`, used in `handleAdded`; `FakeMailSender`. Done when tests pass and the mail shows up in Mailpit (http://localhost:8025) with `make up`.
5. **Tests ported:**
   - `test/test-app.ts` becomes `createTestApp(overrides)` using `Test.createTestingModule({ imports: [AppModule.forRoot({ jobs: false })] })` with overrides for `DB` (PGlite), `JOB_QUEUE` (FakeJobQueue), `MAIL_SENDER`, `LOGGER` and `HEALTH_CHECKS`, then `configureApp` and `init`
   - port `items`, `observability`, `jobs` and `log-file` tests, keeping every assertion: paths list, 422 details, 400 malformed JSON, 500 + log, requestId echo/generation, Bull Board 401 + `www-authenticate`, docs exclusion
   - the Bull Board trailing-slash 302 assertion is adapted to Express behaviour if it differs
6. **Docs and rules updated:**
   - `CLAUDE.md`: NestJS; layering controller → service → repository; integrations = interface + token + single binding module; CJS (no `.js` suffix); Zod from `zod`/`nestjs-zod`; Swagger decorators requirement
   - `docs/architecture.md`: overview, new **ADR-005 "NestJS is the API framework"** (ADR-004 renamed to "Next.js is UI only; NestJS is the single API"), layering table (Controller / Service / Repository / Integration / Job handler), folder structure, "How to add an integration" recipe (the mail example), API documentation section rewritten for `@nestjs/swagger` + `nestjs-zod`, long-running work section for `@nestjs/bullmq`, testing section (`Test.createTestingModule` + `overrideProvider`)
   - `README.md` lines naming the old framework, `.env.example` API comment → `# NestJS API`, add `MAIL_DRIVER=smtp`
   - `docs/plans/0001` untouched

## Reused as-is (or nearly)
- `common/request-context.ts`, `common/log-file.ts`, `common/logger.ts` (only `__dirname`), `common/errors.ts`
- `config.ts` (+ `MAIL_DRIVER`, `.env` loading), `db/schema.ts`, `db/client.ts`, drizzle migrations
- `items.repository.ts`, `items.service.ts` (constructor injection via tokens/classes)
- `jobs/worker.ts`'s `processJob` / `failureOutcome` logic
- `test/test-db.ts`, `test/fake-job-queue.ts`

## Verification
- `npm run typecheck && npm test`: all ported tests are green, plus the new mail test.
- `make up && npm run dev`:
  - `curl -i localhost:3001/api/health` → 200 with `X-Request-ID`
  - `POST /api/items` `{"name":""}` → 422 with `details[0].path = "name"`
  - `POST` with malformed JSON → 400 `HTTP_400`
  - `GET /api/items/999` → 404 `NOT_FOUND`
  - `/docs` lists the 3 paths with all response statuses
  - `/admin/queues` asks for basic auth
  - creating an item produces a worker `item added` log with the same requestId, and an email in Mailpit
- Web app at http://localhost:3000 still lists and creates items with no code changes.

## Outcome (fill in after execution)
Done on 2026-11-27. `npm run typecheck && npm test` green (31 tests, all old assertions kept plus mail, binding, 422-for-bad-id, unknown-route and health-ok tests). Verified live against throwaway Postgres/Redis/Mailpit containers: health 200 + `X-Request-ID`, 422 `details[0].path = "name"`, malformed JSON 400 `HTTP_400`, 404 `NOT_FOUND`, `/docs` lists the 3 paths with every status, `/admin/queues` 401 + `WWW-Authenticate` (200 with credentials), and `POST /api/items` with `x-request-id: live-check-1` gave `item created` → `item added` → `job completed` all carrying that ID plus an "Item added" mail in Mailpit. `npm run build` (web) passes with no web changes.

**Deviations from the plan**
- **No `@nestjs/bullmq` / `@bull-board/nestjs`.** The worker is a plain BullMQ `Worker` in an injectable `JobsWorker` (`jobs/jobs-worker.ts`, started on bootstrap, closed on shutdown) and Bull Board is mounted on Express in `configureApp` (`jobs/bull-board.ts`). This means fewer dependencies, the same behaviour, and the existing `processJob`/`failureOutcome` stay unchanged. Files are `jobs-worker.ts` and `process-job.ts` instead of `jobs.processor.ts` and `worker-utils.ts`.
- **Queue wiring:** the BullMQ `Queue` is its own `QUEUE` token (`integrations/job-queue/queue.ts`), shared by `BullMqJobQueue`, the Redis health check and Bull Board. With `jobs: false`, `JOB_QUEUE` is bound to `DisabledJobQueue` (throws), and tests override it.
- **`AppModule.forRoot({ config, logger, jobs })`**: config and logger are passed in, not built inside, so `main.ts` and tests control them (tests pass a capturing logger).
- **JSON body parsing** happens in `core/request-id.middleware.ts` (`bodyParser: false` on the app), which answers malformed JSON with 400 `HTTP_400` directly. This was the plan's fallback, and it was needed so the requestId context survives the parser.
- **Shutdown** keeps a small SIGINT/SIGTERM handler in `main.ts` (calls `app.close()` and then flushes the log file) instead of `enableShutdownHooks()`, because the log file must be closed after Nest's hooks.
- **`MAIL_DRIVER` is `smtp | log`**: `LogMailSender` was added, so the binding has a real second case.
- **Bull Board trailing slash:** Express answers `/admin/queues/` with 200 (the previous framework gave 302); the test was adapted.
- No `.swcrc`: SWC options live in `nest-cli.json` (`stripLeadingPaths: true`, so `dist/` mirrors `src/` and the `__dirname`-relative paths to `drizzle/` and `storage/logs` resolve) and `vitest.config.mts`.

**Fixed along the way**
- The build emitted to `dist/src/…`, so the server could not find its migrations (`Can't find meta/_journal.json`). Fixed with `stripLeadingPaths`.
- `package-lock.json` had lost the web app's dependencies during the migration's installs; a root `npm install` restored them.
- `npm run dev` (`nest start --watch` with the SWC builder) crashed with `Cannot find module 'chokidar'`: `@swc/cli` needs it for watch mode but only as an optional peer. Added `chokidar` as a server devDependency.
- Vitest `testTimeout`/`hookTimeout` raised to 30s: a cold Nest + PGlite boot takes ~4s, which made the 5s default flaky.

**Follow-ups**
- Tests are ~1s each, mostly PGlite migrations per app. If the suite grows, migrate one PGlite per file and `clone()` it per test.
- A separate worker entry point (`createApplicationContext` + `JobsModule`) when the worker needs to scale apart from the API.
