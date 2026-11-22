import { z } from "@hono/zod-openapi";

/** Example resource. Replace with your own domain; keep the pattern. */
export const itemSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "First item" }),
    createdAt: z.string().openapi({ description: "ISO 8601 timestamp", example: "2026-01-01T09:00:00.000Z" }),
  })
  .openapi("Item");
export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100).openapi({ example: "First item" }),
  })
  .openapi("CreateItem");
export type CreateItem = z.infer<typeof createItemSchema>;
