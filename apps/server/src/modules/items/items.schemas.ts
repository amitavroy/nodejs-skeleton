import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { paginatedSchema } from "../../common/paginated-response.schema";

/** Example resource. Replace with your own domain; keep the pattern. */
export const itemSchema = z
  .object({
    id: z.number().int().meta({ example: 1 }),
    name: z.string().meta({ example: "First item" }),
    createdAt: z.string().meta({ description: "ISO 8601 timestamp", example: "2026-01-01T09:00:00.000Z" }),
  })
  .meta({ id: "Item" });
export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100).meta({ example: "First item" }),
  })
  .meta({ id: "CreateItem" });
export type CreateItem = z.infer<typeof createItemSchema>;

export const itemIdParamSchema = z.object({
  id: z.coerce.number().int().positive().meta({ example: 1 }),
});

export class ItemDto extends createZodDto(itemSchema) {}
export class ItemPageDto extends createZodDto(paginatedSchema(itemSchema, "ItemPage")) {}
export class CreateItemDto extends createZodDto(createItemSchema) {}
export class ItemIdParamDto extends createZodDto(itemIdParamSchema) {}
