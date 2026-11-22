import { pino, type DestinationStream, type Logger } from "pino";
import { getRequestId } from "./request-context.js";

export type { Logger };

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
