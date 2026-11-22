import { z } from "@hono/zod-openapi";

/** Body of every error response (ADR-003). */
export const apiErrorSchema = z
  .object({
    code: z.string().openapi({ example: "VALIDATION_ERROR" }),
    message: z.string().openapi({ example: "Validation failed" }),
    details: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .openapi({ description: "Per-field problems, present for VALIDATION_ERROR" }),
    requestId: z.string().openapi({ description: "Same value as the X-Request-ID response header" }),
  })
  .openapi("ApiError");
