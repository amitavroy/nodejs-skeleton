import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().default(3001),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().default(5433),
  DB_USER: z.string().default("app"),
  DB_PASSWORD: z.string().default("secret"),
  DB_NAME: z.string().default("app"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().default(6380),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default("noreply@example.com"),
});

export type AppConfig = z.infer<typeof envSchema>;

/** The only place that reads process.env. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
