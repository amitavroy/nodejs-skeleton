import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { Worker } from "bullmq";
import { LOGGER, type Logger } from "../common/logger";
import { APP_CONFIG, type AppConfig } from "../config";
import type { JobName } from "../integrations/job-queue/job-queue.interface";
import { QUEUE_NAME, redisConnection, type JobData } from "../integrations/job-queue/queue";
import { ItemsService } from "../modules/items/items.service";
import { createJobHandlers } from "./job-handlers";
import { failureOutcome, processJob } from "./process-job";

/**
 * Processes jobs from the queue. Runs in the API process for now; to scale it out,
 * start a second entry point whose module imports JobsModule but serves no HTTP.
 */
@Injectable()
export class JobsWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker?: Worker<JobData>;

  constructor(
    private readonly items: ItemsService,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    const handlers = createJobHandlers({ items: this.items });
    const logger = this.logger;
    const worker = new Worker<JobData>(
      QUEUE_NAME,
      (job) => processJob(job.name as JobName, job.data, handlers),
      { connection: redisConnection(this.config), concurrency: 5 },
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
    this.worker = worker;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}
