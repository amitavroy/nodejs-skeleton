export type Mail = { to: string; subject: string; text: string };

/** Sends email. Bound to an implementation by MAIL_DRIVER in MailModule; faked in tests. */
export interface MailSender {
  send(mail: Mail): Promise<void>;
}

/** Inject with `@Inject(MAIL_SENDER) private readonly mailer: MailSender`. */
export const MAIL_SENDER = Symbol("MAIL_SENDER");
