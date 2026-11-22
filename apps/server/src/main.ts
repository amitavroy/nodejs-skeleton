import { serve } from "@hono/node-server";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import { BullMqJobQueue } from "./adapters/bullmq-job-queue.adapter.js";
import { createApp } from "./app.js";
import { createLogger } from "./common/logger.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { createJobHandlers } from "./jobs/handlers.js";
import { createQueue } from "./jobs/queue.js";
import { startWorker } from "./jobs/worker.js";
import { createServices } from "./services.js";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const { db, pool } = await createDb(config);
const redisConnection = { host: config.REDIS_HOST, port: config.REDIS_PORT };
const redis = new Redis({ ...redisConnection, lazyConnect: true });

const queue = createQueue(redisConnection);
const jobQueue = new BullMqJobQueue(queue);

const app = createApp({
  db,
  jobQueue,
  logger,
  bullBoard: { queues: [queue], user: config.BULL_BOARD_USER, password: config.BULL_BOARD_PASSWORD },
  healthChecks: {
    postgres: () => db.execute(sql`select 1`),
    redis: async () => {
      if (redis.status === "wait") await redis.connect();
      return redis.ping();
    },
  },
});

// The worker runs in this process for now; to scale it out, move this block to its own entry file.
const worker = startWorker({
  connection: redisConnection,
  logger,
  handlers: createJobHandlers(createServices({ db, logger, jobQueue })),
});

const server = serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  logger.info({ port: info.port }, "server listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close();
  await worker.close();
  await queue.close();
  redis.disconnect();
  await pool.end();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown(signal));
