import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../common/app-env.js";
import { errorResponse, jsonResponse, validationErrorResponse } from "../../common/openapi.js";
import { paginationQuerySchema } from "../../common/pagination.js";
import { paginatedSchema } from "../../common/paginated-response.schema.js";
import { validationHook } from "../../common/validation-hook.js";
import { createItemSchema, itemSchema } from "./items.schemas.js";
import type { ItemsService } from "./items.service.js";

const tags = ["items"];
const idParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" }, example: 1 }),
});

const listRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List items, newest first (paginated, max 100 per page)",
  request: { query: paginationQuerySchema },
  responses: {
    200: jsonResponse(paginatedSchema(itemSchema, "ItemPage"), "A page of items"),
    422: validationErrorResponse,
  },
});

const createItemRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create an item",
  request: { body: { content: { "application/json": { schema: createItemSchema } }, required: true } },
  responses: {
    201: jsonResponse(itemSchema, "The created item"),
    422: validationErrorResponse,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  summary: "Get one item",
  request: { params: idParam },
  responses: {
    200: jsonResponse(itemSchema, "The item"),
    404: errorResponse("NOT_FOUND: no item with this id"),
    422: validationErrorResponse,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags,
  summary: "Delete an item",
  request: { params: idParam },
  responses: {
    204: { description: "Deleted" },
    404: errorResponse("NOT_FOUND: no item with this id"),
    422: validationErrorResponse,
  },
});

/** Controller: validate input, call ONE service method, return the result. */
export function itemsRoutes(service: ItemsService) {
  return new OpenAPIHono<AppEnv>({ defaultHook: validationHook })
    .openapi(listRoute, async (c) => c.json(await service.list(c.req.valid("query")), 200))
    .openapi(createItemRoute, async (c) => c.json(await service.create(c.req.valid("json")), 201))
    .openapi(getRoute, async (c) => c.json(await service.get(c.req.valid("param").id), 200))
    .openapi(deleteRoute, async (c) => {
      await service.remove(c.req.valid("param").id);
      return c.body(null, 204);
    });
}
