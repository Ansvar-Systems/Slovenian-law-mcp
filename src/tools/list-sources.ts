import type { Database } from '@ansvar/mcp-sqlite';

export interface ListSourcesResult {
  sources: Source[];
  database: DatabaseInfo;
}

interface Source {
  name: string;
  authority: string;
  url: string;
  data_type: string;
  license: string;
}

interface DatabaseInfo {
  tier: string;
  schema_version: string;
  built_at: string;
  jurisdiction: string;
}

export async function listSources(db: Database): Promise<ListSourcesResult> {
  const sources: Source[] = [
    {
      name: 'PIS (Pravno-informacijski sistem)',
      authority: 'Služba Vlade RS za zakonodajo (Republic of Slovenia)',
      url: 'https://pisrs.si',
      data_type: 'Consolidated Slovenian statutes and regulations',
      license: 'Government Open Data',
    },
    {
      name: 'Sodna praksa (sodnapraksa.si)',
      authority: 'Vrhovno sodišče Republike Slovenije (Supreme Court of Slovenia)',
      url: 'https://www.sodnapraksa.si',
      data_type: 'Slovenian court decisions (ECLI-identified)',
      license: 'Government Open Data',
    },
    {
      name: 'EUR-Lex',
      authority: 'Publications Office of the European Union',
      url: 'https://eur-lex.europa.eu',
      data_type: 'EU directive/regulation metadata and cross-references',
      license: 'EU Open Data',
    },
  ];

  let tier = 'unknown';
  let schemaVersion = '1';
  let builtAt = 'unknown';

  try {
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='db_metadata'"
    ).get();

    if (hasTable) {
      const rows = db.prepare('SELECT key, value FROM db_metadata').all() as { key: string; value: string }[];
      for (const row of rows) {
        if (row.key === 'tier') tier = row.value;
        if (row.key === 'schema_version') schemaVersion = row.value;
        if (row.key === 'built_at') builtAt = row.value;
      }
    }
  } catch { /* ignore */ }

  return {
    sources,
    database: {
      tier,
      schema_version: schemaVersion,
      built_at: builtAt,
      jurisdiction: 'SI',
    },
  };
}
