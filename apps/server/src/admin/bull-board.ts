import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Queue } from "bullmq";
import { basicAuth } from "hono/basic-auth";
import type { AppEnv } from "../common/app-env.js";

export const BULL_BOARD_PATH = "/admin/queues";

export type BullBoardOptions = { queues: Queue[]; user: string; password: string };

/** Bull Board UI at /admin/queues behind basic auth. Deliberately not part of the OpenAPI docs. */
export function registerBullBoard(app: OpenAPIHono<AppEnv>, { queues, user, password }: BullBoardOptions) {
  const serverAdapter = new HonoAdapter(serveStatic);
  createBullBoard({ queues: queues.map((q) => new BullMQAdapter(q)), serverAdapter });
  serverAdapter.setBasePath(BULL_BOARD_PATH);

  app.use(`${BULL_BOARD_PATH}/*`, basicAuth({ username: user, password }));
  app.get(`${BULL_BOARD_PATH}/`, (c) => c.redirect(BULL_BOARD_PATH)); // the UI itself lives at the path without a slash
  app.route(BULL_BOARD_PATH, serverAdapter.registerPlugin());
}
