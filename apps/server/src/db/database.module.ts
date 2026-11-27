import { Global, Module } from "@nestjs/common";
import type pg from "pg";
import { APP_CONFIG, type AppConfig } from "../config";
import { connectDb, createPool, DB, DB_POOL } from "./client";
import { DatabaseLifecycle } from "./database-lifecycle";

/** Provides DB (Drizzle, migrations applied) to every repository. Tests override DB with PGlite. */
@Global()
@Module({
  providers: [
    { provide: DB_POOL, useFactory: (config: AppConfig) => createPool(config), inject: [APP_CONFIG] },
    { provide: DB, useFactory: (pool: pg.Pool) => connectDb(pool), inject: [DB_POOL] },
    DatabaseLifecycle,
  ],
  exports: [DB],
})
export class DatabaseModule {}
