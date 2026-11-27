import type { OnApplicationShutdown } from "@nestjs/common";
import type { Queue } from "bullmq";
import { getRequestId } from "../../common/request-context";
import type { JobName, JobPayloads, JobQueue } from "./job-queue.interface";
import type { JobData } from "./queue";

/** Enqueues to BullMQ and copies the current requestId into the job data (see jobs/process-job.ts). */
export class BullMqJobQueue implements JobQueue, OnApplicationShutdown {
  constructor(private readonly queue: Pick<Queue<JobData>, "add" | "close">) {}

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void> {
    const data: JobData<N> = { ...payload, requestId: getRequestId() };
    await this.queue.add(name, data);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.queue.close();
  }
}
