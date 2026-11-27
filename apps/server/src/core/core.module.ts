import { type DynamicModule, Global, Module } from "@nestjs/common";
import { LOGGER, type Logger } from "../common/logger";
import { APP_CONFIG, type AppConfig } from "../config";

/** App-wide values every module can inject: APP_CONFIG and LOGGER. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(opts: { config: AppConfig; logger: Logger }): DynamicModule {
    return {
      module: CoreModule,
      providers: [
        { provide: APP_CONFIG, useValue: opts.config },
        { provide: LOGGER, useValue: opts.logger },
      ],
      exports: [APP_CONFIG, LOGGER],
    };
  }
}
