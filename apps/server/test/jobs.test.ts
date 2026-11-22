import { describe, expect, it } from "vitest";
import { BullMqJobQueue } from "../src/adapters/bullmq-job-queue.adapter.js";
import { createLogger } from "../src/common/logger.js";
import { runWithRequestId } from "../src/common/request-context.js";
import { createJobHandlers } from "../src/jobs/handlers.js";
import type { JobData } from "../src/jobs/queue.js";
import { failureOutcome, processJob } from "../src/jobs/worker.js";
import { createServices } from "../src/services.js";
import { FakeJobQueue } from "./fake-job-queue.js";
import { testApp } from "./test-app.js";
import { createTestDb } from "./test-db.js";

/** A stand-in for a BullMQ Queue that records what would be stored in Redis. */
function recordingQueue() {
  const added: { name: string; data: JobData }[] = [];
  return { added, queue: { add: async (name: string, data: JobData) => void added.push({ name, data }) } };
}

describe("BullMqJobQueue", () => {
  it("copies the current requestId into the job data", async () => {
    const { added, queue } = recordingQueue();
    await runWithRequestId("req-77", () => new BullMqJobQueue(queue as never).enqueue("item-added", { itemId: 5 }));
    expect(added).toEqual([{ name: "item-added", data: { itemId: 5, requestId: "req-77" } }]);
  });

  it("enqueues without a requestId outside a request", async () => {
    const { added, queue } = recordingQueue();
    await new BullMqJobQueue(queue as never).enqueue("item-added", { itemId: 5 });
    expect(added[0]?.data.requestId).toBeUndefined();
  });
});

describe("request ID across the queue", () => {
  it("the worker's log lines carry the requestId of the request that added the item", async () => {
    const lines: Record<string, unknown>[] = [];
    const logger = createLogger("info", { write: (chunk: string) => void lines.push(JSON.parse(chunk)) });
    const db = await createTestDb();
    const { added, queue } = recordingQueue();

    // 1. HTTP request with a request ID → item saved, job "stored in Redis"
    const { app } = await testApp({ db, logger, jobQueue: new BullMqJobQueue(queue as never) });
    const res = await app.request("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req-e2e" },
      body: JSON.stringify({ name: "traced" }),
    });
    expect(res.status).toBe(201);
    expect(added[0]?.data).toEqual({ itemId: 1, requestId: "req-e2e" });

    // 2. The worker picks the job up later, outside any request
    const handlers = createJobHandlers(createServices({ db, logger, jobQueue: new FakeJobQueue() }));
    await processJob("item-added", added[0]!.data, handlers);

    const processed = lines.find((l) => l.msg === "item added");
    expect(processed).toMatchObject({ requestId: "req-e2e", itemId: 1, name: "traced" });
  });
});

describe("failureOutcome", () => {
  it("says will_retry until the last attempt, then final_failure", () => {
    expect(failureOutcome({ attemptsMade: 1, opts: { attempts: 3 } })).toEqual({ attempt: 1, maxAttempts: 3, outcome: "will_retry" });
    expect(failureOutcome({ attemptsMade: 3, opts: { attempts: 3 } })).toEqual({ attempt: 3, maxAttempts: 3, outcome: "final_failure" });
  });
});
