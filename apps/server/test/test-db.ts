import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { migrationsFolder, type Db } from "../src/db/client";
import * as schema from "../src/db/schema";

/** A fresh in-memory Postgres (PGlite) with all migrations applied. No Docker needed. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
