import type { AiToolMetadata, PlatformRole } from '@rsd-sync/contracts';
import {
  ExternalValidationRequiredError,
  UnauthorizedOperationError,
  ValidationError,
  type TenantId,
} from '@rsd-sync/shared';
import type { z } from 'zod';

export interface RegisteredAiTool<TArgs = unknown, TResult = unknown> {
  readonly metadata: AiToolMetadata;
  readonly inputSchema: z.ZodType<TArgs>;
  execute(args: TArgs, tenantId: TenantId): Promise<TResult>;
}

export interface ExecuteToolInput {
  readonly tenantId: TenantId;
  readonly actorRole: PlatformRole;
  readonly enabledTenantTools: readonly string[];
  readonly toolName: string;
  readonly rawArgs: unknown;
  readonly externalValidationConfirmed?: boolean | undefined;
}

export class AiToolGuard {
  private readonly registry = new Map<string, RegisteredAiTool<unknown, unknown>>();

  public registerTool<TArgs, TResult>(tool: RegisteredAiTool<TArgs, TResult>): void {
    this.registry.set(tool.metadata.toolName, tool as RegisteredAiTool<unknown, unknown>);
  }

  public getRegisteredToolNames(): readonly string[] {
    return [...this.registry.keys()];
  }

  public async authorizeAndExecute(input: ExecuteToolInput): Promise<unknown> {
    const tool = this.registry.get(input.toolName);
    if (!tool) {
      throw new UnauthorizedOperationError(
        `AI tool "${input.toolName}" is not registered`,
        { toolName: input.toolName },
      );
    }

    if (!input.enabledTenantTools.includes(input.toolName)) {
      throw new UnauthorizedOperationError(
        `AI tool "${input.toolName}" is not enabled for tenant`,
        { tenantId: input.tenantId, toolName: input.toolName },
      );
    }

    if (!tool.metadata.allowedRoles.includes(input.actorRole)) {
      throw new UnauthorizedOperationError(
        `Role ${input.actorRole} cannot execute AI tool "${input.toolName}"`,
        { actorRole: input.actorRole, toolName: input.toolName },
      );
    }

    if (tool.metadata.requiresExternalValidation && !input.externalValidationConfirmed) {
      throw new ExternalValidationRequiredError(
        `Tool "${input.toolName}" requires validated external confirmation`,
        { tenantId: input.tenantId, toolName: input.toolName },
      );
    }

    const parsed = tool.inputSchema.safeParse(input.rawArgs);
    if (!parsed.success) {
      throw new ValidationError(`Invalid arguments for AI tool "${input.toolName}"`, {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return tool.execute(parsed.data, input.tenantId);
  }
}
