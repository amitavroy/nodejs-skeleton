import { Queue, type ConnectionOptions } from "bullmq";
import type { JobName, JobPayloads } from "../ports/job-queue.port.js";

export const QUEUE_NAME = "app-jobs";

/** What is stored in Redis for each job: the payload plus the request that enqueued it. */
export type JobData<N extends JobName = JobName> = JobPayloads[N] & { requestId?: string };

export const JOB_ATTEMPTS = 3;

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
