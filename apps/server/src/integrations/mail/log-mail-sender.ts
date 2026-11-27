import type { Logger } from "../../common/logger";
import type { Mail, MailSender } from "./mail-sender.interface";

/** Writes the mail to the log instead of sending it (MAIL_DRIVER=log). */
export class LogMailSender implements MailSender {
  constructor(private readonly logger: Logger) {}

  async send({ to, subject }: Mail): Promise<void> {
    this.logger.info({ to, subject }, "mail not sent (MAIL_DRIVER=log)");
  }
}
