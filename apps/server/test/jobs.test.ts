import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logger";
import { runWithRequestId } from "../src/common/request-context";
import { loadConfig } from "../src/config";
import { CoreModule } from "../src/core/core.module";
import { BullMqJobQueue } from "../src/integrations/job-queue/bullmq-job-queue";
import type { JobData } from "../src/integrations/job-queue/queue";
import { LogMailSender } from "../src/integrations/mail/log-mail-sender";
import { MAIL_SENDER } from "../src/integrations/mail/mail-sender.interface";
import { MailModule } from "../src/integrations/mail/mail.module";
import { SmtpMailSender } from "../src/integrations/mail/smtp-mail-sender";
import { createJobHandlers } from "../src/jobs/job-handlers";
import { failureOutcome, processJob } from "../src/jobs/process-job";
import { ItemsService } from "../src/modules/items/items.service";
import { createTestApp } from "./test-app";

/** A stand-in for a BullMQ Queue that records what would be stored in Redis. */
function recordingQueue() {
  const added: { name: string; data: JobData }[] = [];
  return {
    added,
    queue: { add: async (name: string, data: JobData) => void added.push({ name, data }), close: async () => {} },
  };
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
    const { added, queue } = recordingQueue();

    // 1. HTTP request with a request ID → item saved, job "stored in Redis"
    const { app, http } = await createTestApp({ logger, jobQueue: new BullMqJobQueue(queue as never) });
    const res = await http.post("/api/items").set("x-request-id", "req-e2e").send({ name: "traced" });
    expect(res.status).toBe(201);
    expect(added[0]?.data).toEqual({ itemId: 1, requestId: "req-e2e" });

    // 2. The worker picks the job up later, outside any request
    const handlers = createJobHandlers({ items: app.get(ItemsService) });
    await processJob("item-added", added[0]!.data, handlers);

    const processed = lines.find((l) => l.msg === "item added");
    expect(processed).toMatchObject({ requestId: "req-e2e", itemId: 1, name: "traced" });
  });
});

describe("item-added job sends mail", () => {
  it("sends one 'Item added' mail through the bound MailSender", async () => {
    const { app, http, mail } = await createTestApp({ config: { MAIL_FROM: "team@example.com" } });
    const { id } = (await http.post("/api/items").send({ name: "mailed" })).body;

    await createJobHandlers({ items: app.get(ItemsService) })["item-added"]({ itemId: id });

    expect(mail.sent).toEqual([
      { to: "team@example.com", subject: "Item added: mailed", text: expect.stringContaining(`Item #${id} "mailed"`) },
    ]);
  });

  it("sends nothing when the item was deleted before the job ran", async () => {
    const { app, mail } = await createTestApp();
    await app.get(ItemsService).handleAdded(999);
    expect(mail.sent).toEqual([]);
  });
});

describe("MailModule binding", () => {
  const boundFor = async (MAIL_DRIVER: "smtp" | "log") => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule.forRoot({ config: { ...loadConfig({}), MAIL_DRIVER }, logger: createLogger("silent") }), MailModule],
    }).compile();
    return moduleRef.get(MAIL_SENDER);
  };

  it("binds MAIL_SENDER by MAIL_DRIVER", async () => {
    expect(await boundFor("smtp")).toBeInstanceOf(SmtpMailSender);
    expect(await boundFor("log")).toBeInstanceOf(LogMailSender);
  });
});

describe("failureOutcome", () => {
  it("says will_retry until the last attempt, then final_failure", () => {
    expect(failureOutcome({ attemptsMade: 1, opts: { attempts: 3 } })).toEqual({ attempt: 1, maxAttempts: 3, outcome: "will_retry" });
    expect(failureOutcome({ attemptsMade: 3, opts: { attempts: 3 } })).toEqual({ attempt: 3, maxAttempts: 3, outcome: "final_failure" });
  });
});
