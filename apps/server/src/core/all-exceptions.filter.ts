import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";
import type { ApiError } from "../common/api-error.schema";
import { DomainError } from "../common/errors";
import type { Logger } from "../common/logger";

/** Turns every exception into `{ code, message, details?, requestId }` (ADR-003). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = String(res.locals.requestId ?? "");
    const send = (status: number, body: Omit<ApiError, "requestId">) => {
      res.status(status).json({ ...body, requestId });
    };

    if (err instanceof DomainError) {
      return send(err.httpStatus, { code: err.code, message: err.message });
    }
    if (err instanceof ZodValidationException) {
      const zodError = err.getZodError();
      const issues = zodError instanceof ZodError ? zodError.issues : [];
      return send(422, {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    if (err instanceof NotFoundException) {
      return send(404, { code: "NOT_FOUND", message: "Route not found" });
    }
    if (err instanceof HttpException && err.getStatus() < 500) {
      const status = err.getStatus();
      return send(status, { code: `HTTP_${status}`, message: err.message || `HTTP ${status}` });
    }
    this.logger.error({ err }, "unhandled exception");
    send(500, { code: "INTERNAL_ERROR", message: "Internal server error" });
  }
}
