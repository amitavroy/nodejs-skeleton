import { createApp, type AppDeps } from "../src/app.js";
import { FakeJobQueue } from "./fake-job-queue.js";
import { createTestDb } from "./test-db.js";

/** An app on in-memory Postgres with a fake job queue. Override any dependency. */
export async function testApp(overrides: Partial<AppDeps> = {}) {
  const jobs = new FakeJobQueue();
  const app = createApp({ db: await createTestDb(), jobQueue: jobs, ...overrides });
  return { app, jobs };
}
