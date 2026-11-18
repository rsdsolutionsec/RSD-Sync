export type ServiceStatusValue =
  | 'operational'
  | 'stopped'
  | 'connected'
  | 'disconnected'
  | 'not_configured'
  | 'unavailable'
  | 'unknown';

export interface PlatformStatusDto {
  readonly apiAvailable: boolean;
  readonly checkedAt: string;
  readonly error?: string | undefined;
  readonly data?: {
    readonly service: string;
    readonly phase: string;
    readonly checkedAt: string;
    readonly environment: {
      readonly nodeEnv: string;
      readonly platformName: string;
      readonly databaseTarget: string;
    };
    readonly api: {
      readonly status: string;
      readonly host: string;
      readonly port: number;
      readonly uptimeSeconds: number;
    };
    readonly worker: {
      readonly status: 'operational' | 'stopped';
      readonly workerId?: string | undefined;
      readonly concurrency?: number | undefined;
      readonly lastHeartbeatAt?: string | undefined;
      readonly queues: readonly string[];
    };
    readonly redis: {
      readonly status: 'connected' | 'disconnected';
      readonly latencyMs: number;
      readonly error?: string | undefined;
    };
    readonly database: {
      readonly status: 'connected' | 'disconnected';
      readonly target: 'local' | 'supabase';
      readonly latencyMs: number;
      readonly error?: string | undefined;
    };
    readonly supabase: {
      readonly status: 'connected' | 'disconnected' | 'not_configured';
      readonly configured: boolean;
      readonly authConfigured: boolean;
      readonly latencyMs?: number | undefined;
      readonly error?: string | undefined;
    };
  } | undefined;
}

export interface TestJobDto {
  readonly jobId: string;
  readonly queue: string;
  readonly name: string;
  readonly state: string;
  readonly attemptsMade: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly processedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly data: {
    readonly correlationId: string;
    readonly requestedBy: string;
    readonly message: string;
    readonly shouldFail: boolean;
    readonly delayMs: number;
  };
  readonly result?: {
    readonly jobId: string;
    readonly processedByWorker: string;
    readonly processedAt: string;
    readonly durationMs: number;
    readonly echoMessage: string;
    readonly attempt: number;
  } | undefined;
  readonly failedReason?: string | undefined;
}

export type ConversationModeDto = 'AI' | 'HUMAN' | 'COPILOT';

export interface ConversationSummaryDto {
  readonly conversationId: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly phoneE164: string;
  readonly channel: string;
  readonly mode: ConversationModeDto;
  readonly aiPaused: boolean;
  readonly assignedUserId: string | null;
  readonly pauseReason: string | null;
  readonly lastMessageAt: string;
  readonly lastMessagePreview: string | null;
  readonly pendingApprovalsCount: number;
}

export interface ConversationMessageDto {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly senderType: 'CUSTOMER' | 'AI' | 'HUMAN' | 'SYSTEM';
  readonly content: string;
  readonly externalMessageId: string | null;
  readonly sentAt: string;
}

export interface CommercialApprovalDto {
  readonly id: string;
  readonly requestType: 'PAYMENT' | 'SALE' | 'INVENTORY_RESERVATION' | 'ENROLLMENT' | 'HUMAN_HANDOFF';
  readonly summary: string;
  readonly status: 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';
  readonly externalSystem: string;
  readonly createdAt: string;
}

export interface ConversationDetailDto {
  readonly conversation: Omit<ConversationSummaryDto, 'lastMessagePreview' | 'pendingApprovalsCount'>;
  readonly messages: readonly ConversationMessageDto[];
  readonly approvals: readonly CommercialApprovalDto[];
}
