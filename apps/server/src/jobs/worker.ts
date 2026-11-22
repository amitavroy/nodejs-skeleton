import { Worker, type ConnectionOptions, type Job } from "bullmq";
import type { Logger } from "../common/logger.js";
import { runWithRequestId } from "../common/request-context.js";
import type { JobName } from "../ports/job-queue.port.js";
import type { JobHandlers } from "./handlers.js";
import { QUEUE_NAME, type JobData } from "./queue.js";

/**
 * Runs one job with the enqueuing request's ID restored, so every log line the
 * handler (and the services it calls) writes carries the same requestId.
 */
export function processJob(name: JobName, data: JobData, handlers: JobHandlers): Promise<void> {
  const run = () => handlers[name](data as never);
  return data.requestId ? runWithRequestId(data.requestId, run) : run();
}

/** Is a failed attempt going to be retried, or is it final? Logged with BullMQ's attempt number. */
export function failureOutcome(job: Pick<Job, "attemptsMade" | "opts">) {
  const maxAttempts = job.opts.attempts ?? 1;
  return {
    attempt: job.attemptsMade,
    maxAttempts,
    outcome: job.attemptsMade < maxAttempts ? ("will_retry" as const) : ("final_failure" as const),
  };
}

export function startWorker(opts: {
  connection: ConnectionOptions;
  logger: Logger;
  handlers: JobHandlers;
  concurrency?: number;
}): Worker<JobData> {
  const { connection, logger, handlers, concurrency = 5 } = opts;
  const worker = new Worker<JobData>(
    QUEUE_NAME,
    async (job) => {
      const name = job.name as JobName;
      await processJob(name, job.data, handlers);
    },
    { connection, concurrency },
  );

  // Event callbacks run outside the job's async context, so pass requestId explicitly.
  worker.on("completed", (job) => {
    logger.info({ requestId: job.data.requestId, jobId: job.id, jobName: job.name }, "job completed");
  });
  worker.on("failed", (job, err) => {
    if (!job) return logger.error({ err }, "job failed");
    logger.error(
      { requestId: job.data.requestId, jobId: job.id, jobName: job.name, ...failureOutcome(job), err },
      "job failed",
    );
  });
  worker.on("error", (err) => logger.error({ err }, "worker error"));
  return worker;
}
