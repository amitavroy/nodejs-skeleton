/** Every background job: its name and payload. Add new jobs here, then a handler in jobs/handlers.ts. */
export type JobPayloads = {
  "item-added": { itemId: number };
};
export type JobName = keyof JobPayloads;

/** How services hand work to the background. Implemented by BullMQ; faked in tests. */
export interface JobQueuePort {
  enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void>;
}
