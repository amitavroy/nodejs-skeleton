import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import type { AppConfig } from "../config.js";
import * as schema from "./schema.js";

/** Repositories depend on this, so they work with node-postgres and with PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export type DbHandle = { db: NodePgDatabase<typeof schema>; pool: pg.Pool };

/** Connects to Postgres and applies pending migrations. */
export async function createDb(config: AppConfig): Promise<DbHandle> {
  const pool = new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { db, pool };
}
