import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { Logger } from "../common/logger";
import { resolveRequestId, runWithRequestId } from "../common/request-context";

/**
 * Runs first for every request (registered in configureApp):
 * - resolves the request ID (X-Request-ID header or a new UUID) and echoes it in the response,
 * - parses JSON bodies (Nest's own parser is turned off) and answers malformed JSON with 400 HTTP_400,
 * - runs the rest of the request inside the request-ID context, so every log line carries it,
 * - logs one "request completed" line when the response is sent.
 *
 * The context is entered after body parsing: the parser's stream callbacks would otherwise lose it.
 */
export function requestIdMiddleware(logger: Logger): RequestHandler {
  const parseJson = express.json();
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.header("x-request-id"));
    res.locals.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    const start = performance.now();
    const path = req.path;
    res.on("finish", () =>
      runWithRequestId(requestId, () =>
        logger.info(
          {
            req: { method: req.method, path },
            res: { statusCode: res.statusCode },
            responseTimeMs: Math.round(performance.now() - start),
          },
          "request completed",
        ),
      ),
    );

    parseJson(req, res, (err?: unknown) =>
      runWithRequestId(requestId, () => {
        if (!err) return next();
        const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : 400;
        const message = err instanceof Error ? err.message : `HTTP ${status}`;
        res.status(status).json({ code: `HTTP_${status}`, message, requestId });
      }),
    );
  };
}
