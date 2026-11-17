import type { CommercialApprovalStatus } from '@rsd-sync/contracts';
import {
  ExternalValidationRequiredError,
  nowUtcIso,
  type TenantId,
} from '@rsd-sync/shared';

export interface RequiresExternalValidation {
  readonly requiresExternalValidation: true;
  readonly externalSystem: string;
  readonly externalReferenceId?: string | undefined;
}

export interface CommercialApprovalRequest extends RequiresExternalValidation {
  readonly approvalId: string;
  readonly tenantId: TenantId;
  readonly conversationId: string;
  readonly requestType: 'PAYMENT' | 'SALE' | 'INVENTORY_RESERVATION' | 'ENROLLMENT';
  readonly status: CommercialApprovalStatus;
  readonly createdAt: string;
  readonly validatedAt?: string | undefined;
}

export interface ExternalValidationEvidence {
  readonly validatedByExternalSystem: boolean;
  readonly externalReferenceId: string;
}

export function resolveCommercialApproval(
  request: CommercialApprovalRequest,
  evidence: ExternalValidationEvidence,
): CommercialApprovalRequest {
  if (!evidence.validatedByExternalSystem) {
    throw new ExternalValidationRequiredError(
      `Cannot confirm ${request.requestType} without external validation from ${request.externalSystem}`,
      { approvalId: request.approvalId, externalSystem: request.externalSystem },
    );
  }

  return {
    ...request,
    status: 'APPROVED',
    externalReferenceId: evidence.externalReferenceId,
    validatedAt: nowUtcIso(),
  };
}
