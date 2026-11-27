import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach } from "vitest";
import { AppModule } from "../src/app.module";
import { createLogger, type Logger } from "../src/common/logger";
import { loadConfig, type AppConfig } from "../src/config";
import { configureApp } from "../src/configure-app";
import { DB, type Db } from "../src/db/client";
import { HEALTH_CHECKS, type HealthChecks } from "../src/health/health.schemas";
import { JOB_QUEUE, type JobQueue } from "../src/integrations/job-queue/job-queue.interface";
import { MAIL_SENDER, type MailSender } from "../src/integrations/mail/mail-sender.interface";
import type { BullBoardOptions } from "../src/jobs/bull-board";
import { FakeJobQueue } from "./fake-job-queue";
import { FakeMailSender } from "./fake-mail-sender";
import { createTestDb } from "./test-db";

export type TestAppOverrides = {
  config?: Partial<AppConfig>;
  db?: Db;
  logger?: Logger;
  jobQueue?: JobQueue;
  mailSender?: MailSender;
  healthChecks?: HealthChecks;
  bullBoard?: BullBoardOptions;
};

const open: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((app) => app.close()));
});

/**
 * The real AppModule without Redis (jobs: false), on in-memory Postgres, with fakes for
 * the job queue and mail. Any dependency can be overridden. Closed after each test.
 */
export async function createTestApp(overrides: TestAppOverrides = {}) {
  const jobs = new FakeJobQueue();
  const mail = new FakeMailSender();
  const config = { ...loadConfig({}), ...overrides.config };
  const logger = overrides.logger ?? createLogger("silent");

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({ config, logger, jobs: false })],
  })
    .overrideProvider(DB)
    .useValue(overrides.db ?? (await createTestDb()))
    .overrideProvider(JOB_QUEUE)
    .useValue(overrides.jobQueue ?? jobs)
    .overrideProvider(MAIL_SENDER)
    .useValue(overrides.mailSender ?? mail)
    .overrideProvider(HEALTH_CHECKS)
    .useValue(overrides.healthChecks ?? { postgres: async () => 1 })
    .compile();

  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app, { bullBoard: overrides.bullBoard });
  await app.init();
  open.push(app);

  return { app, http: request(app.getHttpServer()), jobs, mail };
}
