import { NotFoundError } from "../../common/errors.js";
import type { PaginatedResponse, PaginationQuery } from "../../common/pagination.js";
import type { CreateItem, Item } from "./items.schemas.js";
import type { ItemsRepository } from "./items.repository.js";

/** Business logic lives here. No Drizzle, no Hono, no process.env. */
export class ItemsService {
  constructor(private readonly repo: ItemsRepository) {}

  async list({ page, pageSize }: PaginationQuery): Promise<PaginatedResponse<Item>> {
    const { rows, total } = await this.repo.list(page, pageSize);
    return { data: rows, page, pageSize, total };
  }

  async get(id: number): Promise<Item> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError("Item");
    return item;
  }

  create(input: CreateItem): Promise<Item> {
    return this.repo.create(input.name);
  }

  async remove(id: number): Promise<void> {
    if (!(await this.repo.delete(id))) throw new NotFoundError("Item");
  }
}
