import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).meta({ description: "1-based page number" }),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).meta({ description: "Items per page (max 100)" }),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
};
