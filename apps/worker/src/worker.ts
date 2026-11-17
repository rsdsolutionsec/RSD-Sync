import { parsePlatformConfig, type PlatformConfig } from '@rsd-sync/configuration';
import type { QueueName } from '@rsd-sync/queue';
import { getQueueSubscriptions } from './consumers/index.js';
import { getSchedulerBootstrapDescriptor, type SchedulerBootstrapDescriptor } from './schedulers/index.js';

export interface WorkerBootstrapInfo {
  readonly service: 'rsd-sync-worker';
  readonly phase: 'phase-0-foundation';
  readonly concurrency: number;
  readonly subscriptions: readonly QueueName[];
  readonly scheduler: SchedulerBootstrapDescriptor;
}

export function getWorkerBootstrapInfo(
  config: PlatformConfig = parsePlatformConfig(),
): WorkerBootstrapInfo {
  return {
    service: 'rsd-sync-worker',
    phase: 'phase-0-foundation',
    concurrency: config.WORKER_CONCURRENCY,
    subscriptions: getQueueSubscriptions(),
    scheduler: getSchedulerBootstrapDescriptor(),
  };
}
