import { zValidator } from "@hono/zod-validator";
import type { Context, ValidationTargets } from "hono";
import type { ZodType } from "zod";
import type { AppEnv } from "./app-env.js";

/** Zod validation that answers 422 with the standard error body (ADR-003). */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
          requestId: (c as unknown as Context<AppEnv>).get("requestId"),
        },
        422,
      );
    }
  });
}
