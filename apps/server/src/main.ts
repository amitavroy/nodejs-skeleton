import { serve } from "@hono/node-server";
import { Redis } from "ioredis";
import { sql } from "drizzle-orm";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";

const config = loadConfig();
const { db } = await createDb(config);
const redis = new Redis({ host: config.REDIS_HOST, port: config.REDIS_PORT, lazyConnect: true });

const app = createApp({
  db,
  healthChecks: {
    postgres: () => db.execute(sql`select 1`),
    redis: async () => {
      if (redis.status === "wait") await redis.connect();
      return redis.ping();
    },
  },
});

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
});
