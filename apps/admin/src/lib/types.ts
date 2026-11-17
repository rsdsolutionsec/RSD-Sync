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
