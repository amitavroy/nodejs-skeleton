import { z } from "zod";

/** Example resource. Replace with your own domain; keep the pattern. */
export const itemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  createdAt: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type CreateItem = z.infer<typeof createItemSchema>;
