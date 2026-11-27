import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const healthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    checks: z.record(z.string(), z.enum(["ok", "down"])),
  })
  .meta({ id: "Health" });
export type Health = z.infer<typeof healthSchema>;

export class HealthDto extends createZodDto(healthSchema) {}

/** Each check resolves if the dependency is healthy and throws if not. */
export type HealthChecks = Record<string, () => Promise<unknown>>;

/** Injection token for the checks (bound in HealthModule; tests override it). */
export const HEALTH_CHECKS = Symbol("HEALTH_CHECKS");
