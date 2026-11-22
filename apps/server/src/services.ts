import type { Logger } from "./common/logger.js";
import type { Db } from "./db/client.js";
import { ItemsRepository } from "./modules/items/items.repository.js";
import { ItemsService } from "./modules/items/items.service.js";
import type { JobQueuePort } from "./ports/job-queue.port.js";

export type Services = { items: ItemsService };

/** Wires repositories → services. Used by the HTTP app and by the job worker. */
export function createServices(deps: { db: Db; logger: Logger; jobQueue: JobQueuePort }): Services {
  return { items: new ItemsService(new ItemsRepository(deps.db), deps.logger, deps.jobQueue) };
}
