import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { Queue } from "bullmq";
import { AppModule } from "./app.module";
import { createAppLogger } from "./common/logger";
import { loadConfig, loadEnvFile } from "./config";
import { configureApp } from "./configure-app";
import { PinoNestLogger } from "./core/pino-nest-logger";
import { QUEUE } from "./integrations/job-queue/queue";

async function bootstrap() {
  loadEnvFile();
  const config = loadConfig();
  const { logger, close: closeLogs, logsDir } = createAppLogger({
    level: config.LOG_LEVEL,
    logsAsFile: config.LOGS_AS_FILE,
  });
  // With file logging the terminal would otherwise stay silent; say where the logs go.
  if (logsDir) process.stdout.write(`Logging to ${logsDir}/ (one file per day)\n`);

  const app = await NestFactory.create(AppModule.forRoot({ config, logger, jobs: true }), {
    bodyParser: false, // requestIdMiddleware parses JSON (see core/request-id.middleware.ts)
    logger: new PinoNestLogger(logger),
  });
  configureApp(app, {
    bullBoard: { queues: [app.get<Queue>(QUEUE)], user: config.BULL_BOARD_USER, password: config.BULL_BOARD_PASSWORD },
  });
  await app.listen(config.API_PORT);
  logger.info({ port: config.API_PORT }, "server listening");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down");
    await app.close(); // runs every onApplicationShutdown: worker, queue, database pool
    await closeLogs();
    process.exit(0);
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void shutdown(signal));
}

void bootstrap();
