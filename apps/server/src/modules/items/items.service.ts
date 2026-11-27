import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError } from "../../common/errors";
import { LOGGER, type Logger } from "../../common/logger";
import type { PaginatedResponse, PaginationQuery } from "../../common/pagination";
import { APP_CONFIG, type AppConfig } from "../../config";
import { JOB_QUEUE, type JobQueue } from "../../integrations/job-queue/job-queue.interface";
import { MAIL_SENDER, type MailSender } from "../../integrations/mail/mail-sender.interface";
import { ItemsRepository } from "./items.repository";
import type { CreateItem, Item } from "./items.schemas";

/** Business logic lives here. No Drizzle, no Express, no process.env. */
@Injectable()
export class ItemsService {
  constructor(
    private readonly repo: ItemsRepository,
    @Inject(LOGGER) private readonly log: Logger,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(MAIL_SENDER) private readonly mailer: MailSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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
    await this.mailer.send({
      to: this.config.MAIL_FROM,
      subject: `Item added: ${item.name}`,
      text: `Item #${item.id} "${item.name}" was added at ${item.createdAt}.`,
    });
    this.log.info({ itemId, name: item.name }, "item added");
  }

  async remove(id: number): Promise<void> {
    if (!(await this.repo.delete(id))) throw new NotFoundError("Item");
    this.log.info({ itemId: id }, "item deleted");
  }
}
