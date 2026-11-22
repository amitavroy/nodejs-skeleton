import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { AppEnv } from "./common/app-env.js";
import { DomainError } from "./common/errors.js";
import type { Db } from "./db/client.js";
import { ItemsRepository } from "./modules/items/items.repository.js";
import { itemsRoutes } from "./modules/items/items.routes.js";
import { ItemsService } from "./modules/items/items.service.js";

/** Each check resolves if the dependency is healthy and throws if not. */
export type HealthChecks = Record<string, () => Promise<unknown>>;

export type AppDeps = { db: Db; healthChecks?: HealthChecks };

/** Composition root: wires repositories → services → routes. */
export function createApp({ db, healthChecks = {} }: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const id = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", id);
    c.header("x-request-id", id);
    await next();
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof DomainError) {
      return c.json({ code: err.code, message: err.message, requestId }, err.httpStatus);
    }
    console.error({ requestId, err });
    return c.json({ code: "INTERNAL_ERROR", message: "Something went wrong", requestId }, 500);
  });

  app.notFound((c) =>
    c.json({ code: "NOT_FOUND", message: "Route not found", requestId: c.get("requestId") }, 404),
  );

  app.get("/api/health", async (c) => {
    const checks: Record<string, "ok" | "down"> = {};
    await Promise.all(
      Object.entries(healthChecks).map(async ([name, check]) => {
        checks[name] = await check().then(() => "ok" as const, () => "down" as const);
      }),
    );
    const ok = Object.values(checks).every((s) => s === "ok");
    return c.json({ status: ok ? "ok" : "degraded", checks }, ok ? 200 : 503);
  });

  app.route("/api/items", itemsRoutes(new ItemsService(new ItemsRepository(db))));

  return app;
}

export type AppType = ReturnType<typeof createApp>;
