import { type DynamicModule, Module } from "@nestjs/common";
import type { Logger } from "./common/logger";
import type { AppConfig } from "./config";
import { CoreModule } from "./core/core.module";
import { DatabaseModule } from "./db/database.module";
import { HealthModule } from "./health/health.module";
import { JobQueueModule } from "./integrations/job-queue/job-queue.module";
import { MailModule } from "./integrations/mail/mail.module";
import { JobsModule } from "./jobs/jobs.module";
import { ItemsModule } from "./modules/items/items.module";

export type AppModuleOptions = {
  config: AppConfig;
  logger: Logger;
  /** true: BullMQ queue + worker (needs Redis). false (tests): JOB_QUEUE is a stub to override. */
  jobs: boolean;
};

@Module({})
export class AppModule {
  static forRoot({ config, logger, jobs }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        CoreModule.forRoot({ config, logger }),
        DatabaseModule,
        JobQueueModule.forRoot({ enabled: jobs }),
        MailModule,
        HealthModule,
        ItemsModule,
        ...(jobs ? [JobsModule] : []),
      ],
    };
  }
}
