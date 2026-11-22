import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./common/app-env.js";
import { DomainError } from "./common/errors.js";
import { createLogger, type Logger } from "./common/logger.js";
import { jsonResponse } from "./common/openapi.js";
import { resolveRequestId, runWithRequestId } from "./common/request-context.js";
import { validationHook } from "./common/validation-hook.js";
import { registerBullBoard, type BullBoardOptions } from "./admin/bull-board.js";
import type { Db } from "./db/client.js";
import { itemsRoutes } from "./modules/items/items.routes.js";
import type { JobQueuePort } from "./ports/job-queue.port.js";
import { createServices } from "./services.js";

/** Each check resolves if the dependency is healthy and throws if not. */
export type HealthChecks = Record<string, () => Promise<unknown>>;

export type AppDeps = {
  db: Db;
  jobQueue: JobQueuePort;
  logger?: Logger;
  healthChecks?: HealthChecks;
  /** Mounts the Bull Board UI at /admin/queues when given. */
  bullBoard?: BullBoardOptions;
};

const healthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    checks: z.record(z.string(), z.enum(["ok", "down"])),
  })
  .openapi("Health");

const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  tags: ["health"],
  summary: "Liveness plus dependency checks (Postgres, Redis); 503 if any is down",
  responses: {
    200: jsonResponse(healthSchema, "All dependencies healthy"),
    503: jsonResponse(healthSchema, "At least one dependency is down"),
  },
});

/** Composition root: wires repositories → services → routes. */
export function createApp({ db, jobQueue, logger = createLogger("silent"), healthChecks = {}, bullBoard }: AppDeps) {
  const services = createServices({ db, logger, jobQueue });
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  // Request ID: X-Request-ID header or a new UUID; echoed in the response and attached to every log line.
  app.use("*", async (c, next) => {
    const requestId = resolveRequestId(c.req.header("x-request-id"));
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);
    await runWithRequestId(requestId, async () => {
      const start = performance.now();
      await next();
      logger.info(
        {
          req: { method: c.req.method, path: c.req.path },
          res: { statusCode: c.res.status },
          responseTimeMs: Math.round(performance.now() - start),
        },
        "request completed",
      );
    });
  });

  app.onError((err, c) => {
    const requestId = c.get("requestId");
    if (err instanceof DomainError) {
      return c.json({ code: err.code, message: err.message, requestId }, err.httpStatus);
    }
    if (err instanceof HTTPException) {
      // Framework errors, e.g. malformed JSON → 400 (ADR-003).
      const res = c.json(
        { code: `HTTP_${err.status}`, message: err.message || `HTTP ${err.status}`, requestId },
        err.status,
      );
      // Keep the header that makes browsers show the basic-auth login prompt (Bull Board).
      const challenge = err.getResponse().headers.get("www-authenticate");
      if (challenge) res.headers.set("www-authenticate", challenge);
      return res;
    }
    logger.error({ err }, "unhandled exception");
    return c.json({ code: "INTERNAL_ERROR", message: "Internal server error", requestId }, 500);
  });

  app.notFound((c) =>
    c.json({ code: "NOT_FOUND", message: "Route not found", requestId: c.get("requestId") }, 404),
  );

  app.openapi(healthRoute, async (c) => {
    const checks: Record<string, "ok" | "down"> = {};
    await Promise.all(
      Object.entries(healthChecks).map(async ([name, check]) => {
        checks[name] = await check().then(() => "ok" as const, () => "down" as const);
      }),
    );
    const ok = Object.values(checks).every((s) => s === "ok");
    return c.json({ status: ok ? ("ok" as const) : ("degraded" as const), checks }, ok ? 200 : 503);
  });

  app.route("/api/items", itemsRoutes(services.items));
  if (bullBoard) registerBullBoard(app, bullBoard);

  // Swagger UI at /docs, raw OpenAPI JSON at /docs-json. Generated from the Zod route schemas.
  app.doc("/docs-json", {
    openapi: "3.0.3",
    info: {
      title: "__APP_NAME__ API",
      version: "1.0.0",
      description: "Errors are `{ code, message, details?, requestId }`. Validation errors are 422.",
    },
  });
  app.get("/docs", swaggerUI({ url: "/docs-json" }));

  return app;
}

export type AppType = ReturnType<typeof createApp>;
