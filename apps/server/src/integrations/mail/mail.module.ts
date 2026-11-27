import { Global, Module } from "@nestjs/common";
import { LOGGER, type Logger } from "../../common/logger";
import { APP_CONFIG, type AppConfig } from "../../config";
import { LogMailSender } from "./log-mail-sender";
import { MAIL_SENDER, type MailSender } from "./mail-sender.interface";
import { SmtpMailSender } from "./smtp-mail-sender";

/**
 * The single place where MAIL_SENDER is bound to an implementation (like Laravel's `bind()`).
 * To add a provider (SES, Mailchimp, ...): write a class implementing MailSender, add its
 * name to MAIL_DRIVER in config.ts and one case below. Nothing that injects MAIL_SENDER changes.
 */
@Global()
@Module({
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [APP_CONFIG, LOGGER],
      useFactory: (config: AppConfig, logger: Logger): MailSender => {
        switch (config.MAIL_DRIVER) {
          case "smtp":
            return new SmtpMailSender(config);
          case "log":
            return new LogMailSender(logger);
        }
      },
    },
  ],
  exports: [MAIL_SENDER],
})
export class MailModule {}
