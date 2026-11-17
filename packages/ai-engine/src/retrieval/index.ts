import type { TenantId } from '@rsd-sync/shared';

export interface RetrievalQuery {
  readonly tenantId: TenantId;
  readonly queryText: string;
  readonly topK: number;
}

export interface RetrievedChunk {
  readonly chunkId: string;
  readonly documentId: string;
  readonly content: string;
  readonly similarityScore: number;
}

export interface KnowledgeRetriever {
  retrieve(query: RetrievalQuery): Promise<readonly RetrievedChunk[]>;
}
