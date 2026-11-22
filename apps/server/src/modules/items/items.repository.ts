import { count, desc, eq } from "drizzle-orm";
import type { Item } from "@app/shared";
import type { Db } from "../../db/client.js";
import { items } from "../../db/schema.js";

type Row = typeof items.$inferSelect;
const toItem = (row: Row): Item => ({
  id: row.id,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
});

/** The only layer that touches Drizzle. Returns domain types, never rows. */
export class ItemsRepository {
  constructor(private readonly db: Db) {}

  async list(page: number, pageSize: number): Promise<{ rows: Item[]; total: number }> {
    const rows = await this.db
      .select()
      .from(items)
      .orderBy(desc(items.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [totalRow] = await this.db.select({ n: count() }).from(items);
    return { rows: rows.map(toItem), total: totalRow?.n ?? 0 };
  }

  async findById(id: number): Promise<Item | undefined> {
    const [row] = await this.db.select().from(items).where(eq(items.id, id));
    return row && toItem(row);
  }

  async create(name: string): Promise<Item> {
    const [row] = await this.db.insert(items).values({ name }).returning();
    if (!row) throw new Error("insert returned no row");
    return toItem(row);
  }

  async delete(id: number): Promise<boolean> {
    const rows = await this.db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
    return rows.length > 0;
  }
}
