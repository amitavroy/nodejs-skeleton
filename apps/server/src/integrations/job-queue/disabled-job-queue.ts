import type { JobQueue } from "./job-queue.interface";

/** Bound when the app runs without Redis (AppModule.forRoot({ jobs: false })); tests replace it with a fake. */
export class DisabledJobQueue implements JobQueue {
  async enqueue(): Promise<void> {
    throw new Error("The job queue is disabled (AppModule.forRoot({ jobs: false }))");
  }
}
