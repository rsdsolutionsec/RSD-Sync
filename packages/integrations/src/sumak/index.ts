import {
  ExternalValidationRequiredError,
  type TenantId,
} from '@rsd-sync/shared';
import { z } from 'zod';

export const SUMAK_VALIDATION_POLICY = Object.freeze({
  clientIdentifier: 'SUMAK',
  defaultAccessMode: 'readonly' as const,
  allowAutonomousPaymentConfirmation: false,
  allowAutonomousSaleConfirmation: false,
  allowAutonomousInventoryDeduction: false,
  allowAutonomousEnrollmentConfirmation: false,
});

export type SumakSensitiveOperation =
  | 'confirm_payment'
  | 'confirm_sale'
  | 'deduct_inventory'
  | 'confirm_enrollment';

export function assertSumakOperationValidated(
  operation: SumakSensitiveOperation,
  validatedBySumak: boolean,
): void {
  if (!validatedBySumak) {
    throw new ExternalValidationRequiredError(
      `Operation "${operation}" cannot be confirmed without explicit SUMAK validation`,
      {
        client: SUMAK_VALIDATION_POLICY.clientIdentifier,
        operation,
      },
    );
  }
}

export const SumakProductSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  currency: z.string().min(3),
  active: z.boolean(),
});
export type SumakProduct = z.infer<typeof SumakProductSchema>;

export const SumakInventoryCheckSchema = z.object({
  productId: z.string().min(1),
  availableQuantity: z.number().int().nonnegative(),
  inStock: z.boolean(),
  checkedAt: z.string().datetime(),
});
export type SumakInventoryCheck = z.infer<typeof SumakInventoryCheckSchema>;

export const SumakCourseSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  modality: z.enum(['ONLINE', 'PRESENTIAL', 'HYBRID']),
  price: z.number().nonnegative(),
  currency: z.string().min(3),
  enrollmentOpen: z.boolean(),
});
export type SumakCourse = z.infer<typeof SumakCourseSchema>;

export const SumakEnrollmentStatusSchema = z.object({
  enrollmentId: z.string().min(1),
  courseId: z.string().min(1),
  studentReference: z.string().min(1),
  status: z.enum(['PENDING_VALIDATION', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  validatedBySumak: z.boolean(),
});
export type SumakEnrollmentStatus = z.infer<typeof SumakEnrollmentStatusSchema>;

export const SumakPaymentStatusSchema = z.object({
  paymentReference: z.string().min(1),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  amount: z.number().nonnegative(),
  currency: z.string().min(3),
  validatedBySumak: z.boolean(),
});
export type SumakPaymentStatus = z.infer<typeof SumakPaymentStatusSchema>;

export const SumakCommercialRequestInputSchema = z.object({
  tenantId: z.string().min(1),
  contactPhone: z.string().min(6),
  requestedItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});
export type SumakCommercialRequestInput = z.infer<typeof SumakCommercialRequestInputSchema>;

export const SumakEnrollmentRequestInputSchema = z.object({
  tenantId: z.string().min(1),
  courseId: z.string().min(1),
  applicantName: z.string().min(2),
  applicantPhone: z.string().min(6),
  notes: z.string().optional(),
});
export type SumakEnrollmentRequestInput = z.infer<typeof SumakEnrollmentRequestInputSchema>;

export interface SumakPendingRequestResult {
  readonly requestId: string;
  readonly status: 'PENDING_VALIDATION';
  readonly validatedBySumak: false;
  readonly createdAt: string;
}

export interface SumakIntegrationAdapter {
  getProducts(tenantId: TenantId, searchQuery?: string): Promise<readonly SumakProduct[]>;
  checkInventory(tenantId: TenantId, productId: string): Promise<SumakInventoryCheck>;
  getCourses(tenantId: TenantId, searchQuery?: string): Promise<readonly SumakCourse[]>;
  getEnrollmentStatus(
    tenantId: TenantId,
    enrollmentId: string,
  ): Promise<SumakEnrollmentStatus | null>;
  getPaymentStatus(
    tenantId: TenantId,
    paymentReference: string,
  ): Promise<SumakPaymentStatus | null>;
  createCommercialRequest(
    input: SumakCommercialRequestInput,
  ): Promise<SumakPendingRequestResult>;
  createEnrollmentRequest(
    input: SumakEnrollmentRequestInput,
  ): Promise<SumakPendingRequestResult>;
}
