import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** Body of every error response (ADR-003). */
export const apiErrorSchema = z
  .object({
    code: z.string().meta({ example: "VALIDATION_ERROR" }),
    message: z.string().meta({ example: "Validation failed" }),
    details: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional()
      .meta({ description: "Per-field problems, present for VALIDATION_ERROR" }),
    requestId: z.string().meta({ description: "Same value as the X-Request-ID response header" }),
  })
  .meta({ id: "ApiError" });
export type ApiError = z.infer<typeof apiErrorSchema>;

export class ApiErrorDto extends createZodDto(apiErrorSchema) {}
