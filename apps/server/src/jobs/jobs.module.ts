import { Module } from "@nestjs/common";
import { ItemsModule } from "../modules/items/items.module";
import { JobsWorker } from "./jobs-worker";

/** The background worker. Only imported when jobs are enabled (needs Redis). */
@Module({
  imports: [ItemsModule],
  providers: [JobsWorker],
})
export class JobsModule {}
