import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { APP_CONFIG, type AppConfig } from "../../config";
import { BullMqJobQueue } from "./bullmq-job-queue";
import { DisabledJobQueue } from "./disabled-job-queue";
import { JOB_QUEUE } from "./job-queue.interface";
import { createQueue, QUEUE, redisConnection, type JobData } from "./queue";

/** The single place where JOB_QUEUE is bound to an implementation. */
@Global()
@Module({})
export class JobQueueModule {
  static forRoot({ enabled }: { enabled: boolean }): DynamicModule {
    if (!enabled) {
      return { module: JobQueueModule, providers: [{ provide: JOB_QUEUE, useClass: DisabledJobQueue }], exports: [JOB_QUEUE] };
    }
    return {
      module: JobQueueModule,
      providers: [
        { provide: QUEUE, useFactory: (config: AppConfig) => createQueue(redisConnection(config)), inject: [APP_CONFIG] },
        { provide: JOB_QUEUE, useFactory: (queue: Queue<JobData>) => new BullMqJobQueue(queue), inject: [QUEUE] },
      ],
      exports: [QUEUE, JOB_QUEUE],
    };
  }
}
