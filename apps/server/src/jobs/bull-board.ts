import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { INestApplication } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { NextFunction, Request, Response } from "express";

export const BULL_BOARD_PATH = "/admin/queues";

export type BullBoardOptions = { queues: Queue[]; user: string; password: string };

/** Bull Board UI at /admin/queues behind basic auth. Mounted on Express directly: not part of the OpenAPI docs. */
export function mountBullBoard(app: INestApplication, { queues, user, password }: BullBoardOptions): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({ queues: queues.map((q) => new BullMQAdapter(q)), serverAdapter });

  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  const basicAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.header("authorization") === expected) return next();
    // Without this header browsers show a plain 401 page instead of a login prompt.
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    res.status(401).json({ code: "HTTP_401", message: "Unauthorized", requestId: res.locals.requestId });
  };
  app.use(BULL_BOARD_PATH, basicAuth, serverAdapter.getRouter());
}
