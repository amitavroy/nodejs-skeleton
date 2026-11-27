import type { JobName, JobPayloads, JobQueue } from "../src/integrations/job-queue/job-queue.interface";

/** Records enqueued jobs instead of sending them to Redis. */
export class FakeJobQueue implements JobQueue {
  readonly jobs: { name: JobName; payload: unknown }[] = [];

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void> {
    this.jobs.push({ name, payload });
  }
}
