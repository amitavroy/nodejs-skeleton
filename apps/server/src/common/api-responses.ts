import { ApiResponse } from "@nestjs/swagger";
import { ApiErrorDto } from "./api-error.schema";

/** Documents an error response; name the error `code` in the description (ADR-003). */
export const ApiErrorResponse = (status: number, description: string) =>
  ApiResponse({ status, description, type: ApiErrorDto });

/** The 422 every endpoint with input can return. */
export const ApiValidationErrorResponse = () =>
  ApiErrorResponse(422, "VALIDATION_ERROR: invalid query, params or body. `details` lists { path, message } per field.");
