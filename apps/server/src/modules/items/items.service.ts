import { NotFoundError } from "../../common/errors.js";
import type { Logger } from "../../common/logger.js";
import type { JobQueuePort } from "../../ports/job-queue.port.js";
import type { PaginatedResponse, PaginationQuery } from "../../common/pagination.js";
import type { CreateItem, Item } from "./items.schemas.js";
import type { ItemsRepository } from "./items.repository.js";

/** Business logic lives here. No Drizzle, no Hono, no process.env. */
export class ItemsService {
  constructor(
    private readonly repo: ItemsRepository,
    private readonly log: Logger,
    private readonly jobs: JobQueuePort,
  ) {}

  async list({ page, pageSize }: PaginationQuery): Promise<PaginatedResponse<Item>> {
    const { rows, total } = await this.repo.list(page, pageSize);
    return { data: rows, page, pageSize, total };
  }

  async get(id: number): Promise<Item> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError("Item");
    return item;
  }

  async create(input: CreateItem): Promise<Item> {
    const item = await this.repo.create(input.name);
    // requestId is added automatically; add domain IDs only.
    this.log.info({ itemId: item.id }, "item created");
    // Background work never runs in the request: hand it to the queue (requestId is copied along).
    await this.jobs.enqueue("item-added", { itemId: item.id });
    return item;
  }

  /** Runs in the worker for the "item-added" job. The requestId of the original request is restored. */
  async handleAdded(itemId: number): Promise<void> {
    const item = await this.repo.findById(itemId);
    if (!item) {
      this.log.warn({ itemId }, "item added job: item no longer exists");
      return;
    }
    this.log.info({ itemId, name: item.name }, "item added");
  }

  async remove(id: number): Promise<void> {
    if (!(await this.repo.delete(id))) throw new NotFoundError("Item");
    this.log.info({ itemId: id }, "item deleted");
  }
}
