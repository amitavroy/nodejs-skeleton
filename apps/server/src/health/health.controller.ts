import { Controller, Get, Inject, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { HEALTH_CHECKS, HealthDto, type Health, type HealthChecks } from "./health.schemas";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(HEALTH_CHECKS) private readonly checks: HealthChecks) {}

  @Get()
  @ApiOperation({ summary: "Liveness plus dependency checks (Postgres, Redis); 503 if any is down" })
  @ApiResponse({ status: 200, description: "All dependencies healthy", type: HealthDto })
  @ApiResponse({ status: 503, description: "At least one dependency is down", type: HealthDto })
  async health(@Res({ passthrough: true }) res: Response): Promise<Health> {
    const checks: Health["checks"] = {};
    await Promise.all(
      Object.entries(this.checks).map(async ([name, check]) => {
        checks[name] = await check().then(() => "ok" as const, () => "down" as const);
      }),
    );
    const ok = Object.values(checks).every((s) => s === "ok");
    res.status(ok ? 200 : 503);
    return { status: ok ? "ok" : "degraded", checks };
  }
}
