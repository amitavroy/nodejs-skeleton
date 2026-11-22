# __APP_NAME__

TypeScript monorepo template: Hono API, React UI, Postgres, shared Zod schemas. The app runs on your machine; Postgres, Redis, Mailpit, pgAdmin and Dozzle run in Docker.

## Use this template
```bash
cp -R node-template my-new-project && cd my-new-project
rm -rf node_modules .git
npm run init -- my-new-project     # renames placeholders, creates .env, git init
npm install
make up          # start Postgres, Redis, Mailpit, pgAdmin, Dozzle
npm run dev
```
(`npm run init` only needs Node, so run it before `npm install`.)

## Commands
| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the Docker services (`make help` for more) |
| `npm run dev` | Server (:3001) and web (:5173) with reload |
| `npm test` | Server tests (Vitest, in-memory Postgres via PGlite; no Docker needed) |
| `npm run typecheck` | Type-check all workspaces |
| `npm run build` | Production build of the web app |
| `npm run start` | Start the server only |
| `npm run db:generate` | Create a migration after editing `apps/server/src/db/schema.ts` |

## Services (after `make up`)
| Service | URL / port |
|---|---|
| API | http://localhost:3001 (`/api/health` checks Postgres and Redis) |
| Web | http://localhost:5173 |
| pgAdmin | http://localhost:5050 (no login; server preregistered, password = `DB_PASSWORD`) |
| Mailpit inbox | http://localhost:8025 (SMTP on 1025) |
| Dozzle logs | http://localhost:9000 |
| Postgres | localhost:5433 |
| Redis | localhost:6380 |

Host ports are set in `.env`; defaults avoid the usual 5432/6379 so they don't clash with local installs.

## Layout
```
apps/server/     Hono API: modules/<feature>/{routes,service,repository}, common/, db/, config.ts
apps/web/        React UI
packages/shared/ Zod schemas + types used by both
docs/            architecture.md (ADRs + rules), plans/ (one plan per session)
```
The `items` module is a worked example of every layer. Copy its pattern, then delete it.
