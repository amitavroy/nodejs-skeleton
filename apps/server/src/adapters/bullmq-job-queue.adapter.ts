import type { Queue } from "bullmq";
import { getRequestId } from "../common/request-context.js";
import type { JobData } from "../jobs/queue.js";
import type { JobName, JobPayloads, JobQueuePort } from "../ports/job-queue.port.js";

/** Enqueues to BullMQ and copies the current requestId into the job data (see worker.ts). */
export class BullMqJobQueue implements JobQueuePort {
  constructor(private readonly queue: Pick<Queue<JobData>, "add">) {}

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void> {
    const data: JobData<N> = { ...payload, requestId: getRequestId() };
    await this.queue.add(name, data);
  }
}
