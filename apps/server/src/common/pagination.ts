import { z } from "@hono/zod-openapi";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ description: "1-based page number" }),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: "Items per page (max 100)" }),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};
