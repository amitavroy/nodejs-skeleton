import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../common/app-env.js";
import { paginationQuerySchema } from "../../common/pagination.js";
import { validate } from "../../common/validate.js";
import { createItemSchema } from "./items.schemas.js";
import type { ItemsService } from "./items.service.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** Controller: validate input, call ONE service method, return the result. */
export function itemsRoutes(service: ItemsService) {
  return new Hono<AppEnv>()
    .get("/", validate("query", paginationQuerySchema), async (c) =>
      c.json(await service.list(c.req.valid("query"))),
    )
    .post("/", validate("json", createItemSchema), async (c) =>
      c.json(await service.create(c.req.valid("json")), 201),
    )
    .get("/:id", validate("param", idParam), async (c) =>
      c.json(await service.get(c.req.valid("param").id)),
    )
    .delete("/:id", validate("param", idParam), async (c) => {
      await service.remove(c.req.valid("param").id);
      return c.body(null, 204);
    });
}
