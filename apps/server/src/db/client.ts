import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import type { AppConfig } from "../config";
import * as schema from "./schema";

/** Repositories depend on this, so they work with node-postgres and with PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Injection tokens (provided by DatabaseModule). Repositories inject DB. */
export const DB = Symbol("DB");
export const DB_POOL = Symbol("DB_POOL");

export const migrationsFolder = resolve(__dirname, "../../drizzle");

/** A connection pool. It connects lazily, on the first query. */
export function createPool(config: AppConfig): pg.Pool {
  return new pg.Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  });
}

/** Wraps the pool in Drizzle and applies pending migrations. */
export async function connectDb(pool: pg.Pool): Promise<Db> {
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
