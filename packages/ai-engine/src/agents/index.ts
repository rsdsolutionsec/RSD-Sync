import type { TenantId } from '@rsd-sync/shared';
import type { AiProviderName } from '../providers/index.js';

export interface AiAgentConfig {
  readonly agentId: string;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly provider: AiProviderName;
  readonly model: string;
  readonly systemPromptVersion: string;
  readonly enabledTools: readonly string[];
  readonly dailyCostLimitUsd: number;
}
