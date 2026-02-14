#!/usr/bin/env tsx
/**
 * Import EU legislation documents and create reference mappings.
 *
 * Reads EU references from seed files and creates eu_references entries
 * linking Slovenian statutes to EU instruments.
 *
 * Usage: npm run import:eurlex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEUReferences } from '../src/parsers/eu-reference-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

interface EUReference {
  source_type: string;
  source_id: string;
  document_id: string;
  eu_document_id: string;
  eu_article?: string;
  reference_type: string;
  full_citation?: string;
  is_primary_implementation?: number;
  implementation_status?: string;
}

async function main(): Promise<void> {
  console.log('=== Import EUR-Lex Documents ===');
  console.log();

  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found.');
    process.exit(0);
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const euDocuments = new Map<string, { type: string; year: number; number: number; community?: string }>();
  const euReferences: EUReference[] = [];

  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const seed = JSON.parse(raw);

    if (!seed.provisions) continue;

    const documentId = seed.documents?.[0]?.id ?? file.replace('.json', '');

    for (const prov of seed.provisions) {
      const refs = extractEUReferences(prov.content);

      for (const ref of refs) {
        const euDocId = `${ref.type}:${ref.year}/${ref.number}`;

        euDocuments.set(euDocId, {
          type: ref.type,
          year: ref.year,
          number: ref.number,
          community: ref.community,
        });

        euReferences.push({
          source_type: 'provision',
          source_id: `${documentId}:${prov.provision_ref}`,
          document_id: documentId,
          eu_document_id: euDocId,
          eu_article: ref.article,
          reference_type: ref.reference_type,
          full_citation: ref.raw_match,
          is_primary_implementation: ref.reference_type === 'implements' ? 1 : 0,
        });
      }
    }
  }

  if (euDocuments.size > 0) {
    const euDocsArray = Array.from(euDocuments.entries()).map(([id, doc]) => ({
      id,
      type: doc.type,
      year: doc.year,
      number: doc.number,
      community: doc.community ?? 'EU',
      in_force: 1,
    }));

    const seedPath = path.join(SEED_DIR, 'eu-references-extracted.json');
    fs.writeFileSync(seedPath, JSON.stringify({
      eu_documents: euDocsArray,
      eu_references: euReferences,
    }, null, 2), 'utf-8');

    console.log(`Extracted ${euDocuments.size} EU documents and ${euReferences.length} references`);
    console.log(`Wrote eu-references-extracted.json`);
  } else {
    console.log('No EU references found in seed files.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
