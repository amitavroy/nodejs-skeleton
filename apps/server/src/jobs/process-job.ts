import type { Job } from "bullmq";
import { runWithRequestId } from "../common/request-context";
import type { JobName } from "../integrations/job-queue/job-queue.interface";
import type { JobData } from "../integrations/job-queue/queue";
import type { JobHandlers } from "./job-handlers";

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
