#!/usr/bin/env tsx
/**
 * Extract legal definitions from seed files.
 *
 * Scans provision text for definition patterns like
 * "V tem zakonu..." or "Pojem X pomeni..."
 *
 * Usage: npm run extract:definitions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

interface ExtractedDefinition {
  document_id: string;
  term: string;
  definition: string;
  source_provision: string;
}

function extractDefinitionsFromText(
  documentId: string,
  provisionRef: string,
  content: string,
): ExtractedDefinition[] {
  const defs: ExtractedDefinition[] = [];

  // Pattern: numbered list items in definition articles
  // "1. pojem X pomeni ..."
  const numberedPattern = /(\d+)\.\s*(?:pojem\s+)?["„»]?([^"«»"]+?)["«»"]?\s+(?:pomeni|je|so|pomenijo)\s+(.*?)(?=\d+\.\s+(?:pojem)?|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = numberedPattern.exec(content)) !== null) {
    const term = match[2].trim();
    const definition = match[3].trim();

    if (term.length > 1 && term.length < 200 && definition.length > 5) {
      defs.push({
        document_id: documentId,
        term,
        definition,
        source_provision: provisionRef,
      });
    }
  }

  return defs;
}

async function main(): Promise<void> {
  console.log('=== Extract Legal Definitions ===');
  console.log();

  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found.');
    process.exit(0);
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const allDefs: ExtractedDefinition[] = [];

  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const seed = JSON.parse(raw);

    if (!seed.provisions) continue;

    const documentId = seed.documents?.[0]?.id ?? file.replace('.json', '');

    for (const prov of seed.provisions) {
      // Check if this is a definitions article (commonly article 2 or 3)
      if (/pomen\s+izrazov|v\s+tem\s+zakonu/i.test(prov.content)) {
        const defs = extractDefinitionsFromText(documentId, prov.provision_ref, prov.content);
        allDefs.push(...defs);
      }
    }
  }

  if (allDefs.length > 0) {
    // Append definitions to each relevant seed file
    const defsByDoc = new Map<string, ExtractedDefinition[]>();
    for (const def of allDefs) {
      const existing = defsByDoc.get(def.document_id) ?? [];
      existing.push(def);
      defsByDoc.set(def.document_id, existing);
    }

    for (const [docId, defs] of defsByDoc) {
      const seedPath = path.join(SEED_DIR, `${docId}.json`);
      if (fs.existsSync(seedPath)) {
        const raw = fs.readFileSync(seedPath, 'utf-8');
        const seed = JSON.parse(raw);
        seed.definitions = defs;
        fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2), 'utf-8');
        console.log(`  Added ${defs.length} definitions to ${docId}.json`);
      }
    }
  }

  console.log();
  console.log(`Done. Extracted ${allDefs.length} definitions.`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
