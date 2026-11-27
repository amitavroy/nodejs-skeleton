import { z } from "zod";

/** Response schema for list endpoints: paginatedSchema(itemSchema, "ItemPage"). */
export function paginatedSchema<T extends z.ZodType>(item: T, name: string) {
  return z
    .object({
      data: z.array(item),
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
    })
    .meta({ id: name });
}
