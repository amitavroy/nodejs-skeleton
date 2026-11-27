import type { Mail, MailSender } from "../src/integrations/mail/mail-sender.interface";

/** Records mails instead of sending them. */
export class FakeMailSender implements MailSender {
  readonly sent: Mail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }
}
