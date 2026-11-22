import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDb } from "./test-db.js";

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  app = createApp({ db: await createTestDb() });
});

const post = (body: unknown) =>
  app.request("/api/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("items API", () => {
  it("creates and lists items with pagination", async () => {
    expect((await post({ name: "first" })).status).toBe(201);
    await post({ name: "second" });
    const res = await app.request("/api/items?pageSize=1");
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("second");
  });

  it("answers 422 with field details on invalid input", async () => {
    const res = await post({ name: "" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details[0].path).toBe("name");
    expect(body.requestId).toBeTruthy();
  });

  it("answers 404 for a missing item", async () => {
    const res = await app.request("/api/items/999");
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("deletes an item", async () => {
    const { id } = await (await post({ name: "temp" })).json();
    expect((await app.request(`/api/items/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await app.request(`/api/items/${id}`)).status).toBe(404);
  });
});

describe("health", () => {
  it("reports degraded with 503 when a dependency is down", async () => {
    const down = createApp({
      db: await createTestDb(),
      healthChecks: { ok: async () => 1, broken: async () => Promise.reject(new Error("x")) },
    });
    const res = await down.request("/api/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", checks: { ok: "ok", broken: "down" } });
  });
});
