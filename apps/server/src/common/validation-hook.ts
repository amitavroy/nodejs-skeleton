import type { Hook } from "@hono/zod-openapi";
import type { AppEnv } from "./app-env.js";

/** Default hook for every OpenAPIHono router: Zod failures answer 422 with the standard body (ADR-003). */
export const validationHook: Hook<unknown, AppEnv, string, unknown> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        requestId: c.get("requestId"),
      },
      422,
    );
  }
};
