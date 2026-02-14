#!/usr/bin/env tsx
/**
 * Fetch EU legislation metadata from EUR-Lex.
 *
 * Retrieves metadata about EU directives and regulations that are
 * relevant to Slovenian law.
 *
 * Usage: npm run fetch:eurlex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const EURLEX_BASE = 'https://eur-lex.europa.eu/search.html';
const RATE_LIMIT_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
}

interface EUDocument {
  id: string;
  type: 'directive' | 'regulation' | 'decision';
  year: number;
  number: number;
  community?: string;
  celex_number?: string;
  title?: string;
  title_sl?: string;
  short_name?: string;
  in_force?: number;
  url_eur_lex?: string;
}

/**
 * Generate EUR-Lex URL for a document.
 */
function eurLexUrl(celex: string): string {
  return `https://eur-lex.europa.eu/legal-content/SL/TXT/?uri=CELEX:${celex}`;
}

/**
 * Parse EU document ID into components.
 * Format: "directive:2019/770" or "regulation:2016/679"
 */
function parseEuDocumentId(id: string): { type: string; year: number; number: number } | null {
  const match = id.match(/^(directive|regulation|decision):(\d{4})\/(\d+)$/);
  if (!match) return null;
  return { type: match[1], year: parseInt(match[2], 10), number: parseInt(match[3], 10) };
}

async function main(): Promise<void> {
  console.log('=== Fetch EUR-Lex Metadata ===');
  console.log();

  ensureSeedDir();

  // Read existing seed files to find EU references
  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  const euDocIds = new Set<string>();

  for (const file of seedFiles) {
    const raw = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8');
    const seed = JSON.parse(raw);

    if (seed.eu_references) {
      for (const ref of seed.eu_references) {
        euDocIds.add(ref.eu_document_id);
      }
    }
  }

  if (euDocIds.size === 0) {
    // Add common EU documents relevant to Slovenian law
    const commonDocs = [
      'regulation:2016/679',  // GDPR
      'directive:2019/770',   // Digital Content
      'directive:2019/771',   // Sale of Goods
      'directive:2006/112',   // VAT
      'regulation:2017/1001', // EU Trademark
      'directive:2014/24',    // Public Procurement
    ];
    for (const id of commonDocs) euDocIds.add(id);
  }

  console.log(`Processing ${euDocIds.size} EU documents...`);

  const euDocuments: EUDocument[] = [];

  for (const id of euDocIds) {
    const parsed = parseEuDocumentId(id);
    if (!parsed) continue;

    euDocuments.push({
      id,
      type: parsed.type as EUDocument['type'],
      year: parsed.year,
      number: parsed.number,
      community: 'EU',
      in_force: 1,
      url_eur_lex: eurLexUrl(`3${parsed.year}${parsed.type === 'regulation' ? 'R' : 'L'}${String(parsed.number).padStart(4, '0')}`),
    });

    await sleep(100);
  }

  const seedPath = path.join(SEED_DIR, 'eu-documents.json');
  fs.writeFileSync(seedPath, JSON.stringify({ eu_documents: euDocuments }, null, 2), 'utf-8');
  console.log(`\nWrote eu-documents.json (${euDocuments.length} documents)`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
