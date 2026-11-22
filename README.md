# __APP_NAME__

A starter for TypeScript web apps: a **Next.js** web app, a **Hono** REST API with background jobs, and **Postgres**. The two apps are independent and share no code. The apps run on your machine with `npm run dev`; the supporting services (database, queue, mail catcher, admin tools) run in Docker with `make up`.

The example feature is a list of **items**: add one in the web app and you can follow it through the API, the database, the job queue and the logs using the URLs below.

## Start a new app from this template
```bash
cp -R node-template my-new-app && cd my-new-app
rm -rf node_modules .git
npm run init       # asks for the app name and database details (needs only Node)
npm install
make up            # start Postgres, Redis, Mailpit, pgAdmin, Dozzle in Docker
npm run dev        # API on :3001, web app on :3000
```
Then open http://localhost:3000.

`npm run init` asks for:
1. **App name** (lowercase, digits, dashes; e.g. `video-magic`). Replaces the `__APP_NAME__` placeholder everywhere: package names, page title, docs, Docker project name.
2. **Database name**, **database user** and **database password**. It writes `.env` from `.env.example` with these values, and points the pgAdmin server list at the same database. The name and user default to the app name with underscores; press Enter on the password to get a random one (it is saved as `DB_PASSWORD` in `.env`).

It also runs `git init` if the folder has no repository. It refuses to run twice, and asks before overwriting an existing `.env`. For scripts and CI, pass everything as flags and nothing is asked:
```bash
npm run init -- --name my-app --db-name my_app --db-user my_app --db-password 'pick-a-password' --yes
```
(`--yes` takes the defaults for anything you leave out. Passwords need at least 6 characters and must not contain spaces or the characters # $ quotes, backticks or backslashes, which break `.env` files.)

Changing a database name, user or password later: edit `.env`, update `docker/pgadmin/servers.json`, and recreate the database volume, because Postgres only reads these on first start.

## Where to see things
Everything below is available once `make up` and `npm run dev` are running. Ports are the defaults; change them in `.env`.

### The app
| What | URL | What you'll see | Port setting |
|---|---|---|---|
| **Web app** | http://localhost:3000 | The UI: add, list and delete items | `WEB_PORT` |
| **API** | http://localhost:3001/api/items | The JSON API the web app calls (also reachable through the web app at `localhost:3000/api/...`) | `API_PORT` |
| **API health** | http://localhost:3001/api/health | `ok`, or `degraded` (HTTP 503) if Postgres or Redis is down | `API_PORT` |

### API documentation and jobs
| What | URL | What you'll see | Login |
|---|---|---|---|
| **Swagger UI** | http://localhost:3001/docs | Every endpoint with its parameters and responses; you can try requests here | none |
| **OpenAPI JSON** | http://localhost:3001/docs-json | The same documentation as machine-readable JSON | none |
| **Bull Board** | http://localhost:3001/admin/queues | Background jobs: waiting, active, completed, failed, with their data and retries | `admin` / `admin` (`BULL_BOARD_USER`, `BULL_BOARD_PASSWORD`) |

### Supporting services (Docker)
| What | URL / address | What you'll see | Login | Port setting |
|---|---|---|---|---|
| **pgAdmin** | http://localhost:5050 | Browse the database tables and run SQL | none; connect to the preregistered server with your database password (`DB_PASSWORD` in `.env`) | `PGADMIN_PORT` |
| **Mailpit** | http://localhost:8025 | Inbox of every email the app sends in development (nothing is ever delivered). The template doesn't send mail yet. | none | `MAILPIT_PORT` |
| **Dozzle** | http://localhost:9000 | Live logs of the Docker containers (Postgres, Redis, ...) | none | `DOZZLE_PORT` |
| Postgres | `localhost:5433` | For database tools (the database name, user and password you chose) | `DB_NAME`, `DB_USER`, `DB_PASSWORD` in `.env` | `DB_PORT` |
| Redis | `localhost:6380` | For Redis tools; used by the job queue | none | `REDIS_PORT` |
| SMTP | `localhost:1025` | Where the app sends mail; Mailpit catches it | none | `SMTP_PORT` |

**Application logs** are not in Dozzle (the apps don't run in Docker). They appear in the terminal where `npm run dev` runs, as JSON lines. Every line has a `requestId`: send an `X-Request-ID` header (or read it from the response) and search the log for it to follow one request, including the background job it started.

## Try it
1. Open http://localhost:3000 and add an item.
2. **Swagger UI** shows the `POST /api/items` endpoint that was called.
3. **pgAdmin** shows the new row in the `items` table.
4. **Bull Board** shows an `item-added` job in `app-jobs`, completed.
5. The terminal running `npm run dev` shows `item created`, `request completed` and `item added`, all with the same `requestId`.

## Commands
| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the Docker services (`make help` lists more) |
| `npm run dev` | API and web app with reload |
| `npm test` | Server tests (Vitest, in-memory Postgres via PGlite; no Docker needed) |
| `npm run typecheck` | Type-check all workspaces |
| `npm run build` | Production build of the web app (`npm run start -w @app/web` serves it) |
| `npm run start` | Start the API only |
| `make outdated` | List packages (API and web app) that have newer versions: *Wanted* is a safe update, *Latest* may be a breaking major |
| `make update` | Safe update: newest versions your `package.json` ranges allow, then typecheck, tests and web build |
| `make upgrade` | Upgrade everything to the latest version, including majors that may break, then typecheck, tests and build. Review with `git diff`; undo with `git checkout package.json apps/*/package.json package-lock.json && npm install` |
| `npm run db:generate` | Create a migration after editing `apps/server/src/db/schema.ts` |

## Layout
```
apps/server/     Hono API: modules/<feature>/{routes,service,repository}, jobs/, ports/, adapters/, common/, db/, config.ts
apps/web/        Next.js UI (own API types in src/types.ts; the browser calls /api, proxied to the API)
docker/          Config for the Docker services (Postgres init, pgAdmin server list)
docs/            architecture.md (decisions and rules), plans/ (one plan per unit of work)
CLAUDE.md        Working rules for AI coding sessions
```
The `items` module is a worked example of every layer. Copy its pattern, then delete it.

## Learn more
- `docs/architecture.md`: stack, decisions (ADRs), layering rules, logging and request IDs, API documentation rules, job queue.
- `docs/plans/README.md`: how work is planned and tracked.
