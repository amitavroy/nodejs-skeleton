import { Queue } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "../src/common/logger.js";
import type { Db } from "../src/db/client.js";
import { testApp } from "./test-app.js";

/** A logger whose JSON lines are collected in memory. */
function capturingLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger("info", { write: (chunk: string) => void lines.push(JSON.parse(chunk)) });
  return { logger, lines };
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("request id", () => {
  it("echoes a valid X-Request-ID and puts it in error bodies", async () => {
    const app = (await testApp()).app;
    const res = await app.request("/api/items/999", { headers: { "x-request-id": "abc-123" } });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
    expect((await res.json()).requestId).toBe("abc-123");
  });

  it("generates one when absent, and replaces one longer than 128 chars", async () => {
    const app = (await testApp()).app;
    const generated = (await app.request("/api/health")).headers.get("x-request-id");
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    const tooLong = "x".repeat(129);
    const res = await app.request("/api/health", { headers: { "x-request-id": tooLong } });
    expect(res.headers.get("x-request-id")).not.toBe(tooLong);
  });
});

describe("logging", () => {
  it("logs every request with the requestId, and service logs carry it too", async () => {
    const { logger, lines } = capturingLogger();
    const app = (await testApp({ logger })).app;
    await app.request("/api/items", { ...json({ name: "logged" }), headers: { "content-type": "application/json", "x-request-id": "req-1" } });

    const created = lines.find((l) => l.msg === "item created");
    expect(created).toMatchObject({ requestId: "req-1", itemId: 1 });
    const completed = lines.find((l) => l.msg === "request completed");
    expect(completed).toMatchObject({ requestId: "req-1", req: { method: "POST", path: "/api/items" }, res: { statusCode: 201 } });
  });

  it("answers 500 with a generic message and logs the cause with the requestId", async () => {
    const { logger, lines } = capturingLogger();
    const app = (await testApp({ db: {} as Db, logger })).app; // broken db → repository throws
    const res = await app.request("/api/items", { headers: { "x-request-id": "req-500" } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ code: "INTERNAL_ERROR", message: "Internal server error", requestId: "req-500" });
    expect(lines.find((l) => l.msg === "unhandled exception")).toMatchObject({ level: 50, requestId: "req-500" });
  });
});

describe("errors from the framework", () => {
  it("answers 400 HTTP_400 for malformed JSON (not 422)", async () => {
    const app = (await testApp()).app;
    const res = await app.request("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("HTTP_400");
  });
});

describe("OpenAPI docs", () => {
  it("documents every route with its error responses, derived from the Zod schemas", async () => {
    const app = (await testApp()).app;
    const doc = await (await app.request("/docs-json")).json();
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/health", "/api/items", "/api/items/{id}"]);
    expect(Object.keys(doc.paths["/api/items"].post.responses).sort()).toEqual(["201", "422"]);
    expect(Object.keys(doc.paths["/api/items/{id}"].delete.responses).sort()).toEqual(["204", "404", "422"]);
    // defaults and bounds come through from the Zod query schema
    const pageSize = doc.paths["/api/items"].get.parameters.find((p: { name: string }) => p.name === "pageSize");
    expect(pageSize.schema).toMatchObject({ default: 20, maximum: 100 });
    expect(doc.components.schemas.ApiError).toBeTruthy();
  });

  it("serves Swagger UI at /docs", async () => {
    const app = (await testApp()).app;
    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("swagger-ui");
  });
});

describe("Bull Board", () => {
  // A real Queue object pointed at a closed port: the dashboard shell renders without Redis.
  const queues: Queue[] = [];
  const stubQueue = () => {
    const q = new Queue("app-jobs", { connection: { host: "127.0.0.1", port: 1, retryStrategy: () => null, enableOfflineQueue: false } });
    q.on("error", () => {});
    queues.push(q);
    return q;
  };
  afterEach(async () => {
    await Promise.all(queues.splice(0).map((q) => q.disconnect().catch(() => {})));
  });

  it("is protected by basic auth", async () => {
    const { app } = await testApp({ bullBoard: { queues: [stubQueue()], user: "admin", password: "pw" } });
    const denied = await app.request("/admin/queues");
    expect(denied.status).toBe(401);
    // without this header browsers show a plain 401 page instead of a login prompt
    expect(denied.headers.get("www-authenticate")).toMatch(/^Basic /);
    const ok = await app.request("/admin/queues", { headers: { authorization: `Basic ${btoa("admin:pw")}` } });
    expect(ok.status).toBe(200);
    const slash = await app.request("/admin/queues/", { headers: { authorization: `Basic ${btoa("admin:pw")}` } });
    expect(slash.status).toBe(302);
  });

  it("is not part of the OpenAPI document", async () => {
    const { app } = await testApp({ bullBoard: { queues: [stubQueue()], user: "admin", password: "pw" } });
    const doc = await (await app.request("/docs-json")).json();
    expect(Object.keys(doc.paths).some((p) => p.startsWith("/admin"))).toBe(false);
  });
});
