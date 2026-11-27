import type { JobName, JobPayloads } from "../integrations/job-queue/job-queue.interface";
import type { ItemsService } from "../modules/items/items.service";

export type JobHandlers = { [N in JobName]: (payload: JobPayloads[N]) => Promise<void> };

/** Thin: each handler calls one service method. No business logic here. */
export function createJobHandlers(services: { items: ItemsService }): JobHandlers {
  return {
    "item-added": ({ itemId }) => services.items.handleAdded(itemId),
  };
}
