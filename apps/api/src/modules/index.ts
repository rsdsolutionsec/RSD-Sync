export const API_MODULE_BOUNDARIES = [
  'health',
  'webhooks',
  'tenants',
  'conversations',
  'automations',
] as const;

export type ApiModuleBoundary = (typeof API_MODULE_BOUNDARIES)[number];
