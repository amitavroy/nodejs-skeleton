import { Queue, type ConnectionOptions } from "bullmq";
import type { AppConfig } from "../../config";
import type { JobName, JobPayloads } from "./job-queue.interface";

export const QUEUE_NAME = "app-jobs";

/** Injection token for the BullMQ Queue (used by the JobQueue binding, the health check and Bull Board). */
export const QUEUE = Symbol("QUEUE");

/** What is stored in Redis for each job: the payload plus the request that enqueued it. */
export type JobData<N extends JobName = JobName> = JobPayloads[N] & { requestId?: string };

export const JOB_ATTEMPTS = 3;

export function redisConnection(config: AppConfig): ConnectionOptions {
  return { host: config.REDIS_HOST, port: config.REDIS_PORT };
}

export function createQueue(connection: ConnectionOptions): Queue<JobData> {
  return new Queue<JobData>(QUEUE_NAME, {
    // Fail fast (the request gets a 500) instead of hanging while Redis is down.
    connection: { ...connection, enableOfflineQueue: false },
    defaultJobOptions: {
      attempts: JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}
