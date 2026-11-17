import type { TenantId } from '@rsd-sync/shared';

export interface PromptTemplate {
  readonly templateId: string;
  readonly tenantId: TenantId;
  readonly version: string;
  readonly body: string;
}

export function renderPromptTemplate(
  template: string,
  variables: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const replacement = variables[key];
    return replacement !== undefined ? replacement : match;
  });
}
