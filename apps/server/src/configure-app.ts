import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc, ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";
import { LOGGER, type Logger } from "./common/logger";
import { AllExceptionsFilter } from "./core/all-exceptions.filter";
import { requestIdMiddleware } from "./core/request-id.middleware";
import { mountBullBoard, type BullBoardOptions } from "./jobs/bull-board";

/** Everything outside the module graph: middleware, prefix, validation, errors, docs. Used by main.ts and tests. */
export function configureApp(app: INestApplication, opts: { bullBoard?: BullBoardOptions } = {}): void {
  const logger = app.get<Logger>(LOGGER);

  // Must run before anything else (create the app with { bodyParser: false }: this parses JSON).
  app.use(requestIdMiddleware(logger));
  if (opts.bullBoard) mountBullBoard(app, opts.bullBoard);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // Swagger UI at /docs, raw OpenAPI JSON at /docs-json. Generated from the Zod DTOs.
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("__APP_NAME__ API")
      .setVersion("1.0.0")
      .setDescription("Errors are `{ code, message, details?, requestId }`. Validation errors are 422.")
      .build(),
  );
  SwaggerModule.setup("docs", app, cleanupOpenApiDoc(doc), { jsonDocumentUrl: "docs-json" });
}
