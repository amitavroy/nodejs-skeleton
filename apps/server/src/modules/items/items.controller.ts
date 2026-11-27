import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ZodResponse } from "nestjs-zod";
import { ApiErrorResponse, ApiValidationErrorResponse } from "../../common/api-responses";
import { PaginationQueryDto } from "../../common/pagination";
import { CreateItemDto, ItemDto, ItemIdParamDto, ItemPageDto } from "./items.schemas";
import { ItemsService } from "./items.service";

/** Controller: input is validated by the Zod DTOs; call ONE service method and return the result. */
@ApiTags("items")
@Controller("items")
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @ApiOperation({ summary: "List items, newest first (paginated, max 100 per page)" })
  @ZodResponse({ status: 200, description: "A page of items", type: ItemPageDto })
  @ApiValidationErrorResponse()
  list(@Query() query: PaginationQueryDto) {
    return this.items.list(query);
  }

  @Post()
  @ApiOperation({ summary: "Create an item" })
  @ZodResponse({ status: 201, description: "The created item", type: ItemDto })
  @ApiValidationErrorResponse()
  create(@Body() body: CreateItemDto) {
    return this.items.create(body);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one item" })
  @ZodResponse({ status: 200, description: "The item", type: ItemDto })
  @ApiErrorResponse(404, "NOT_FOUND: no item with this id")
  @ApiValidationErrorResponse()
  get(@Param() { id }: ItemIdParamDto) {
    return this.items.get(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an item" })
  @ApiResponse({ status: 204, description: "Deleted" })
  @ApiErrorResponse(404, "NOT_FOUND: no item with this id")
  @ApiValidationErrorResponse()
  async remove(@Param() { id }: ItemIdParamDto): Promise<void> {
    await this.items.remove(id);
  }
}
