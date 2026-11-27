/** Every background job: its name and payload. Add new jobs here, then a handler in jobs/job-handlers.ts. */
export type JobPayloads = {
  "item-added": { itemId: number };
};
export type JobName = keyof JobPayloads;

/** How services hand work to the background. Bound to BullMQ in JobQueueModule; faked in tests. */
export interface JobQueue {
  enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void>;
}

/** Inject with `@Inject(JOB_QUEUE) private readonly jobs: JobQueue`. */
export const JOB_QUEUE = Symbol("JOB_QUEUE");
