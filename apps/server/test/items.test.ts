import { beforeEach, describe, expect, it } from "vitest";
import type { FakeJobQueue } from "./fake-job-queue";
import { createTestApp } from "./test-app";

let http: Awaited<ReturnType<typeof createTestApp>>["http"];
let jobs: FakeJobQueue;

beforeEach(async () => {
  ({ http, jobs } = await createTestApp());
});

const post = (body: unknown) => http.post("/api/items").send(body as object);

describe("items API", () => {
  it("creates and lists items with pagination", async () => {
    expect((await post({ name: "first" })).status).toBe(201);
    await post({ name: "second" });
    const res = await http.get("/api/items?pageSize=1");
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("second");
  });

  it("enqueues an item-added job when an item is created", async () => {
    await post({ name: "queued" });
    expect(jobs.jobs).toEqual([{ name: "item-added", payload: { itemId: 1 } }]);
  });

  it("answers 422 with field details on invalid input", async () => {
    const res = await post({ name: "" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].path).toBe("name");
    expect(res.body.requestId).toBeTruthy();
  });

  it("answers 422 (not 400) for a non-numeric id", async () => {
    const res = await http.get("/api/items/abc");
    expect(res.status).toBe(422);
    expect(res.body.details[0].path).toBe("id");
  });

  it("answers 404 for a missing item", async () => {
    const res = await http.get("/api/items/999");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("answers 404 NOT_FOUND for an unknown route", async () => {
    const res = await http.get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("deletes an item", async () => {
    const { id } = (await post({ name: "temp" })).body;
    expect((await http.delete(`/api/items/${id}`)).status).toBe(204);
    expect((await http.get(`/api/items/${id}`)).status).toBe(404);
  });
});

describe("health", () => {
  it("reports ok with 200 when every dependency is up", async () => {
    const res = await http.get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { postgres: "ok" } });
  });

  it("reports degraded with 503 when a dependency is down", async () => {
    const { http: down } = await createTestApp({
      healthChecks: { ok: async () => 1, broken: async () => Promise.reject(new Error("x")) },
    });
    const res = await down.get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", checks: { ok: "ok", broken: "down" } });
  });
});
