import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

async function importDist(pkgPath) {
  const fullPath = resolve(rootDir, pkgPath);
  return import(pathToFileURL(fullPath).href);
}

async function main() {
  const { loadLocalEnvIfPresent, parsePlatformConfig } = await importDist(
    'packages/configuration/dist/index.js',
  );
  const { PostgresDatabaseClient, BotOperationsRepository } = await importDist(
    'packages/database/dist/index.js',
  );
  const {
    SUMAK_TENANT_SEED_CONFIG,
    SUMAK_DEFAULT_SYSTEM_PROMPT,
    SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS,
  } = await importDist('packages/integrations/dist/index.js');

  loadLocalEnvIfPresent(rootDir);
  const config = parsePlatformConfig();
  const db = PostgresDatabaseClient.fromPlatformConfig(config, { useDirectConnection: true });
  const repo = new BotOperationsRepository(db);

  try {
    const tenantId = await repo.ensureTenant({
      slug: SUMAK_TENANT_SEED_CONFIG.slug,
      name: SUMAK_TENANT_SEED_CONFIG.name,
    });

    const phoneNumberId =
      config.WHATSAPP_PHONE_NUMBER_ID ?? SUMAK_TENANT_SEED_CONFIG.defaultChannelAccountId;

    await repo.upsertChannelConnection(tenantId, {
      channel: 'WHATSAPP',
      externalAccountId: phoneNumberId,
      displayName: 'SUMAK WhatsApp Local',
    });

    await repo.upsertAiAgent(tenantId, {
      name: SUMAK_TENANT_SEED_CONFIG.agentName,
      provider: config.AI_DEFAULT_PROVIDER,
      model: config.AI_DEFAULT_MODEL,
      systemPrompt: SUMAK_DEFAULT_SYSTEM_PROMPT,
      dailyCostLimitUsd: 10,
    });

    for (const doc of SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS) {
      await repo.upsertKnowledgeDocument(tenantId, doc);
    }

    console.log(
      JSON.stringify(
        {
          seeded: true,
          target: db.target,
          tenantSlug: SUMAK_TENANT_SEED_CONFIG.slug,
          tenantId,
          phoneNumberId,
          aiProvider: config.AI_DEFAULT_PROVIDER,
          aiModel: config.AI_DEFAULT_MODEL,
          knowledgeDocumentsCount: SUMAK_AUDIT_KNOWLEDGE_DOCUMENTS.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Seed SUMAK failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
