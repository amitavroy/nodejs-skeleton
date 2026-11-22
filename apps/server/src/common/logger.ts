import { resolve } from "node:path";
import { pino, type DestinationStream, type Logger } from "pino";
import { createDailyFileStream } from "./log-file.js";
import { getRequestId } from "./request-context.js";

export type { Logger };

/** <repo root>/storage/logs, whatever the working directory is. */
export const LOGS_DIR = resolve(import.meta.dirname, "../../../../storage/logs");

/**
 * JSON logs. Every line carries `requestId` automatically while a request is in flight,
 * so services just call `log.info({ itemId }, "item created")` and add domain IDs only.
 */
export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      mixin: () => {
        const requestId = getRequestId();
        return requestId ? { requestId } : {};
      },
    },
    destination,
  );
}

/**
 * The application logger: stdout when `logsAsFile` is false, otherwise one file per day in
 * `storage/logs/` (and nothing on stdout). Call `close()` on shutdown to flush the file.
 */
export function createAppLogger(opts: { level: string; logsAsFile: boolean; dir?: string }) {
  if (!opts.logsAsFile) {
    return { logger: createLogger(opts.level), close: async () => {}, logsDir: undefined };
  }
  const dir = opts.dir ?? LOGS_DIR;
  const file = createDailyFileStream(dir);
  return { logger: createLogger(opts.level, file), close: () => file.close(), logsDir: dir };
}
