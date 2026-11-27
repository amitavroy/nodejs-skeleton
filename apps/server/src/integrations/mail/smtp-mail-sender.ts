import { createTransport, type Transporter } from "nodemailer";
import type { AppConfig } from "../../config";
import type { Mail, MailSender } from "./mail-sender.interface";

/** Sends over SMTP (Mailpit in development: SMTP_HOST/SMTP_PORT from .env). */
export class SmtpMailSender implements MailSender {
  private readonly transport: Transporter;

  constructor(private readonly config: Pick<AppConfig, "SMTP_HOST" | "SMTP_PORT" | "MAIL_FROM">) {
    this.transport = createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: false });
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.config.MAIL_FROM, ...mail });
  }
}
