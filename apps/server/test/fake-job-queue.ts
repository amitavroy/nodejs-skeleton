import type { JobName, JobPayloads, JobQueuePort } from "../src/ports/job-queue.port.js";

/** Records enqueued jobs instead of sending them to Redis. */
export class FakeJobQueue implements JobQueuePort {
  readonly jobs: { name: JobName; payload: unknown }[] = [];

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void> {
    this.jobs.push({ name, payload });
  }
}
