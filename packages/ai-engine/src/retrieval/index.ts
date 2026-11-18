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

export interface KnowledgeDocumentCandidate {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly content: string;
}

const STOP_WORDS = new Set([
  'para',
  'como',
  'cual',
  'cuales',
  'donde',
  'cuando',
  'sobre',
  'tienen',
  'tiene',
  'quiero',
  'hola',
  'buenos',
  'dias',
  'tardes',
  'noches',
  'gracias',
  'favor',
  'esta',
  'este',
  'esto',
  'unos',
  'unas',
]);

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function selectRelevantKnowledgeSnippets(
  documents: readonly KnowledgeDocumentCandidate[],
  queryText: string,
  topK = 3,
): readonly RetrievedChunk[] {
  if (documents.length === 0 || topK <= 0) {
    return [];
  }

  const queryTokens = Array.from(new Set(normalizeTokens(queryText)));
  const scored = documents.map((doc) => {
    const normalizedDoc = `${doc.title} ${doc.category} ${doc.content}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let matchCount = 0;
    for (const token of queryTokens) {
      if (normalizedDoc.includes(token)) {
        matchCount += normalizedDoc.indexOf(token) < doc.title.length + 12 ? 2 : 1;
      }
    }

    const similarityScore =
      queryTokens.length > 0 ? Math.min(1, matchCount / Math.max(queryTokens.length, 1)) : 0.2;

    return {
      chunkId: `${doc.id}#0`,
      documentId: doc.id,
      content: `[${doc.title}]\n${doc.content}`,
      similarityScore,
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, topK);
}
