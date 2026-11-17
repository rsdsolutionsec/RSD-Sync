import type { TenantId } from '@rsd-sync/shared';

export interface KnowledgeDocument {
  readonly documentId: string;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly sourceType: 'manual' | 'markdown' | 'catalog' | 'faq';
  readonly updatedAt: string;
}

export interface KnowledgeChunk {
  readonly chunkId: string;
  readonly documentId: string;
  readonly tenantId: TenantId;
  readonly content: string;
  readonly tokenCount: number;
}

export interface EmbeddingProvider {
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}
