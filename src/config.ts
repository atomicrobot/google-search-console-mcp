import { z } from "zod";

const envSchema = z.object({
  GCP_PROJECT_ID: z.string().min(1),
  BQ_DATASET: z.string().default("searchconsole"),
  BQ_TABLE: z.string().default("searchdata_url_impression"),
  MAX_BYTES_BILLED: z.coerce.number().int().positive().default(1_000_000_000),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  ALLOWED_DOMAIN: z.string().min(1),
  SERVER_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  FIRESTORE_OAUTH_DATABASE: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8080),
  DATA_AVAILABLE_FROM: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${errors.join("\n")}`);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) {
    throw new Error("Config not loaded. Call loadConfig() first.");
  }
  return _config;
}

export function getFullTableId(config: Config): string {
  return `${config.GCP_PROJECT_ID}.${config.BQ_DATASET}.${config.BQ_TABLE}`;
}
