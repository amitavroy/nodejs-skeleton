import type { JobName, JobPayloads } from "../ports/job-queue.port.js";
import type { Services } from "../services.js";

export type JobHandlers = { [N in JobName]: (payload: JobPayloads[N]) => Promise<void> };

/** Thin: each handler calls one service method. No business logic here. */
export function createJobHandlers(services: Services): JobHandlers {
  return {
    "item-added": ({ itemId }) => services.items.handleAdded(itemId),
  };
}
