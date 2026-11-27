import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  // true: write date-wise files to storage/logs/ (nothing on stdout). false: write to stdout.
  LOGS_AS_FILE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  API_PORT: z.coerce.number().int().default(3001),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().default(5433),
  DB_USER: z.string().default("app"),
  DB_PASSWORD: z.string().default("secret"),
  DB_NAME: z.string().default("app"),
  BULL_BOARD_USER: z.string().min(1).default("admin"),
  BULL_BOARD_PASSWORD: z.string().min(1).default("admin"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6380),
  // Which MailSender implementation is bound (integrations/mail/mail.module.ts).
  MAIL_DRIVER: z.enum(["smtp", "log"]).default("smtp"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default("noreply@example.com"),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Injection token for the parsed AppConfig (provided by CoreModule). */
export const APP_CONFIG = Symbol("APP_CONFIG");

/** Loads the repo-root .env (npm runs the server from apps/server) if it exists. Real env vars win. */
export function loadEnvFile(path = resolve(process.cwd(), "../../.env")): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/** The only place that reads process.env. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
