import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type pg from "pg";
import { DB_POOL } from "./client";

/** Closes the connection pool when the app shuts down. */
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
