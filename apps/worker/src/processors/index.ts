import { QUEUE_NAMES, type QueueName } from '@rsd-sync/queue';

export interface WorkerProcessorDescriptor {
  readonly queue: QueueName;
  readonly responsibility: string;
}

export const DEFAULT_PROCESSOR_DESCRIPTORS: readonly WorkerProcessorDescriptor[] = [
  { queue: QUEUE_NAMES.EVENTS, responsibility: 'Normalize and route domain events' },
  { queue: QUEUE_NAMES.AUTOMATIONS, responsibility: 'Execute tenant automation workflows' },
  { queue: QUEUE_NAMES.AI_INFERENCE, responsibility: 'Run provider-agnostic AI inference and tools' },
  { queue: QUEUE_NAMES.WHATSAPP_INBOUND, responsibility: 'Process verified inbound WhatsApp payloads' },
  { queue: QUEUE_NAMES.WHATSAPP_OUTBOUND, responsibility: 'Dispatch outbound WhatsApp responses' },
  { queue: QUEUE_NAMES.DEAD_LETTER, responsibility: 'Persist exhausted jobs for inspection' },
];
