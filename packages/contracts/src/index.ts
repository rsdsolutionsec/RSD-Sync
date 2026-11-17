import type { CorrelationId, ExecutionId, TenantId, UserId } from '@rsd-sync/shared';
import { z } from 'zod';

export const TenantIdSchema = z
  .string()
  .min(1)
  .transform((value) => value as TenantId);

export const UserIdSchema = z
  .string()
  .min(1)
  .transform((value) => value as UserId);

export const CorrelationIdSchema = z
  .string()
  .min(1)
  .transform((value) => value as CorrelationId);

export const ExecutionIdSchema = z
  .string()
  .min(1)
  .transform((value) => value as ExecutionId);

export const TenantLimitsSchema = z.object({
  maxConcurrentExecutions: z.number().int().positive().default(10),
  maxDailyMessages: z.number().int().nonnegative().default(5000),
  maxDailyAiCostUsd: z.number().nonnegative().default(25),
});
export type TenantLimits = z.infer<typeof TenantLimitsSchema>;

export const TenantContextSchema = z.object({
  tenantId: TenantIdSchema,
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  timezone: z.string().min(1).default('UTC'),
  limits: TenantLimitsSchema.default({}),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

export const ExecutionStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const DomainEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  tenantId: TenantIdSchema,
  eventType: z.string().min(3),
  correlationId: CorrelationIdSchema,
  idempotencyKey: z.string().min(8),
  occurredAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});
export type DomainEventEnvelope = z.infer<typeof DomainEventEnvelopeSchema>;

export const ConversationModeSchema = z.enum(['AI', 'HUMAN', 'COPILOT']);
export type ConversationMode = z.infer<typeof ConversationModeSchema>;

export const ChannelTypeSchema = z.enum(['WHATSAPP', 'WEB', 'EMAIL', 'API']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const CommercialApprovalStatusSchema = z.enum([
  'PENDING_VALIDATION',
  'APPROVED',
  'REJECTED',
]);
export type CommercialApprovalStatus = z.infer<typeof CommercialApprovalStatusSchema>;

export const PlatformRoleSchema = z.enum([
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'OPERATOR',
  'SECRETARY',
  'AI_AGENT',
]);
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

export const AiToolMetadataSchema = z.object({
  toolName: z.string().min(2),
  description: z.string().min(4),
  readOnly: z.boolean(),
  requiresExternalValidation: z.boolean(),
  allowedRoles: z.array(PlatformRoleSchema).min(1),
});
export type AiToolMetadata = z.infer<typeof AiToolMetadataSchema>;

export const AiUsageMetricsSchema = z.object({
  tenantId: TenantIdSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  recordedAt: z.string().datetime(),
});
export type AiUsageMetrics = z.infer<typeof AiUsageMetricsSchema>;
