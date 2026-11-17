import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ValidationError } from '@rsd-sync/shared';
import { z } from 'zod';

const DEV_MASTER_KEY_PLACEHOLDER = 'dev-only-32-byte-master-key-change-me';
const DEV_JWT_SECRET_PLACEHOLDER = 'dev-only-jwt-secret-minimum-32-characters-long';

export const PlatformEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    PLATFORM_NAME: z.string().min(1).default('rsd-sync'),

    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    API_URL: z.string().url().default('http://127.0.0.1:4000'),
    ADMIN_API_KEY: z.string().min(16).optional(),

    WORKER_CONCURRENCY: z.coerce.number().int().positive().max(200).default(5),

    ADMIN_PORT: z.coerce.number().int().positive().max(65535).default(3000),
    APP_URL: z.string().url().default('http://127.0.0.1:3000'),
    NEXT_PUBLIC_API_URL: z.string().url().default('http://127.0.0.1:4000'),
    ADMIN_EMAILS: z.string().optional(),
    DEV_ADMIN_ACCESS_KEY: z.string().min(8).optional(),

    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://rsd_sync:rsd_sync_dev_password@127.0.0.1:54332/rsd_sync_dev'),

    DATABASE_TARGET: z.enum(['auto', 'local', 'supabase']).default('auto'),
    RSD_DATABASE_URL: z.string().min(1).optional(),
    RSD_DATABASE_DIRECT_URL: z.string().min(1).optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),

    ENCRYPTION_MASTER_KEY: z.string().min(32).default(DEV_MASTER_KEY_PLACEHOLDER),
    JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET_PLACEHOLDER),
    WEBHOOK_SIGNATURE_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),

    AI_DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENAI_API_KEY: z.string().optional(),
    AI_DAILY_COST_LIMIT_USD: z.coerce.number().nonnegative().default(10),

    WHATSAPP_API_VERSION: z.string().min(2).default('v21.0'),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    WHATSAPP_APP_SECRET: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

    SUMAK_ADAPTER_MODE: z.enum(['readonly', 'validated_write']).default('readonly'),
    SUMAK_SUPABASE_URL: z.string().optional(),
    SUMAK_SUPABASE_ANON_KEY: z.string().optional(),
    SUMAK_API_BASE_URL: z.string().optional(),
    SUMAK_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (data.ENCRYPTION_MASTER_KEY === DEV_MASTER_KEY_PLACEHOLDER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENCRYPTION_MASTER_KEY'],
          message: 'Production requires a non-default ENCRYPTION_MASTER_KEY',
        });
      }
      if (data.JWT_SECRET === DEV_JWT_SECRET_PLACEHOLDER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'Production requires a non-default JWT_SECRET',
        });
      }
    }
  });

export type PlatformConfig = z.infer<typeof PlatformEnvSchema>;

export function loadLocalEnvIfPresent(startDir: string = process.cwd()): string | null {
  if (process.env['VERCEL'] || process.env['NODE_ENV'] === 'production') {
    return null;
  }
  let current = resolve(/*turbopackIgnore: true*/ startDir);
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(/*turbopackIgnore: true*/ current, '.env');
    if (existsSync(candidate)) {
      if (typeof process.loadEnvFile === 'function') {
        process.loadEnvFile(candidate);
      }
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
}

export function parsePlatformConfig(
  env: Record<string, string | undefined> = process.env,
): PlatformConfig {
  const normalizedEnv: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    normalizedEnv[key] = value === '' ? undefined : value;
  }

  const parsed = PlatformEnvSchema.safeParse(normalizedEnv);
  if (!parsed.success) {
    throw new ValidationError('Invalid platform environment configuration', {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export interface EffectiveDatabaseConnection {
  readonly target: 'local' | 'supabase';
  readonly connectionString: string;
  readonly directConnectionString: string;
}

export function resolveEffectiveDatabaseConnection(
  config: PlatformConfig,
): EffectiveDatabaseConnection {
  const hasRemoteDatabaseUrl = Boolean(config.RSD_DATABASE_URL);

  if (config.DATABASE_TARGET === 'supabase') {
    if (!config.RSD_DATABASE_URL) {
      throw new ValidationError(
        'DATABASE_TARGET=supabase requires RSD_DATABASE_URL to be configured',
      );
    }
    return {
      target: 'supabase',
      connectionString: config.RSD_DATABASE_URL,
      directConnectionString: config.RSD_DATABASE_DIRECT_URL ?? config.RSD_DATABASE_URL,
    };
  }

  if (config.DATABASE_TARGET === 'auto' && hasRemoteDatabaseUrl && config.RSD_DATABASE_URL) {
    const isSupabaseUrl =
      config.RSD_DATABASE_URL.includes('supabase.co') ||
      config.RSD_DATABASE_URL.includes('supabase.com') ||
      Boolean(config.SUPABASE_URL);

    return {
      target: isSupabaseUrl ? 'supabase' : 'local',
      connectionString: config.RSD_DATABASE_URL,
      directConnectionString: config.RSD_DATABASE_DIRECT_URL ?? config.RSD_DATABASE_URL,
    };
  }

  return {
    target: 'local',
    connectionString: config.DATABASE_URL,
    directConnectionString: config.RSD_DATABASE_DIRECT_URL ?? config.DATABASE_URL,
  };
}

export function parseAdminEmails(rawEmails: string | undefined): readonly string[] {
  if (!rawEmails) {
    return [];
  }
  return rawEmails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 3 && email.includes('@'));
}

export function isSupabaseBackendConfigured(config: PlatformConfig): boolean {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && config.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabasePublicAuthConfigured(config: PlatformConfig): boolean {
  return Boolean(config.NEXT_PUBLIC_SUPABASE_URL && config.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function maskUrlCredentials(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '[REDACTED_URL]';
  }
}

const SECRET_KEYS = new Set<keyof PlatformConfig>([
  'ADMIN_API_KEY',
  'DEV_ADMIN_ACCESS_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_MASTER_KEY',
  'JWT_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENAI_API_KEY',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'SUMAK_SUPABASE_ANON_KEY',
  'SUMAK_WEBHOOK_SECRET',
]);

const URL_CREDENTIAL_KEYS = new Set<keyof PlatformConfig>([
  'DATABASE_URL',
  'RSD_DATABASE_URL',
  'RSD_DATABASE_DIRECT_URL',
  'REDIS_URL',
]);

export function redactConfigForLogging(config: PlatformConfig): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEYS.has(key as keyof PlatformConfig)) {
      redacted[key] = value ? '[REDACTED]' : undefined;
      continue;
    }

    if (URL_CREDENTIAL_KEYS.has(key as keyof PlatformConfig) && typeof value === 'string') {
      redacted[key] = maskUrlCredentials(value);
      continue;
    }

    redacted[key] = value;
  }

  return redacted;
}
