#!/usr/bin/env tsx
/**
 * Populate cross-references between statutes.
 *
 * Scans provision text for references to other statutes/articles
 * and adds cross_references entries to seed files.
 *
 * Usage: npm run populate:xrefs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCrossReferences, resolveStatuteAbbreviation } from '../src/parsers/cross-ref-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

interface CrossRef {
  source_document_id: string;
  source_provision_ref: string;
  target_document_id: string;
  target_provision_ref?: string;
  ref_type: string;
}

async function main(): Promise<void> {
  console.log('=== Populate Cross-References ===');
  console.log();

  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found.');
    process.exit(0);
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const knownDocIds = new Set<string>();

  // First pass: collect known document IDs
  for (const file of seedFiles) {
    const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
    const seed = JSON.parse(raw);
    if (seed.documents) {
      for (const doc of seed.documents) {
        knownDocIds.add(doc.id);
      }
    }
  }

  let totalXrefs = 0;

  // Second pass: extract cross-references
  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const seed = JSON.parse(raw);

    if (!seed.provisions) continue;

    const documentId = seed.documents?.[0]?.id ?? file.replace('.json', '');
    const xrefs: CrossRef[] = [];

    for (const prov of seed.provisions) {
      const refs = extractCrossReferences(prov.content);

      for (const ref of refs) {
        if (ref.target_statute) {
          const targetDocId = resolveStatuteAbbreviation(ref.target_statute);
          if (targetDocId && knownDocIds.has(targetDocId) && targetDocId !== documentId) {
            xrefs.push({
              source_document_id: documentId,
              source_provision_ref: prov.provision_ref,
              target_document_id: targetDocId,
              target_provision_ref: ref.target_article,
              ref_type: 'references',
            });
          }
        }
      }
    }

    if (xrefs.length > 0) {
      seed.cross_references = [...(seed.cross_references ?? []), ...xrefs];
      fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf-8');
      console.log(`  Added ${xrefs.length} cross-references to ${file}`);
      totalXrefs += xrefs.length;
    }
  }

  console.log();
  console.log(`Done. Added ${totalXrefs} cross-references.`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
