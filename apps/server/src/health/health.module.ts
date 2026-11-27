import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { sql } from "drizzle-orm";
import { DB, type Db } from "../db/client";
import { QUEUE } from "../integrations/job-queue/queue";
import { HealthController } from "./health.controller";
import { HEALTH_CHECKS, type HealthChecks } from "./health.schemas";

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_CHECKS,
      inject: [DB, { token: QUEUE, optional: true }],
      useFactory: (db: Db, queue?: Queue): HealthChecks => ({
        postgres: () => db.execute(sql`select 1`),
        ...(queue && { redis: () => queue.getJobCounts() }),
      }),
    },
  ],
})
export class HealthModule {}
