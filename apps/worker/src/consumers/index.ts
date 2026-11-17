import { DEFAULT_PROCESSOR_DESCRIPTORS } from '../processors/index.js';
import type { QueueName } from '@rsd-sync/queue';

export function getQueueSubscriptions(): readonly QueueName[] {
  return DEFAULT_PROCESSOR_DESCRIPTORS.map((descriptor) => descriptor.queue);
}
