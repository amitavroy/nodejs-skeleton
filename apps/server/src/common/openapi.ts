import type { z } from "@hono/zod-openapi";
import { apiErrorSchema } from "./api-error.schema.js";

/** A JSON response entry for createRoute({ responses }). */
export function jsonResponse<T extends z.ZodType>(schema: T, description: string) {
  return { content: { "application/json": { schema } }, description };
}

/** An error response entry; name the `code` in the description (ADR-003). */
export function errorResponse(description: string) {
  return jsonResponse(apiErrorSchema, description);
}

export const validationErrorResponse = errorResponse(
  "VALIDATION_ERROR: invalid query, params or body. `details` lists { path, message } per field.",
);
