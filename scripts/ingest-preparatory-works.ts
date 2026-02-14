#!/usr/bin/env tsx
/**
 * Preparatory works (zakonodajno gradivo) ingestion script.
 *
 * Fetches parliamentary materials from the Državni zbor website.
 *
 * Usage: npm run ingest:prep
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const DZ_BASE = 'https://www.dz-rs.si';
const RATE_LIMIT_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
}

interface PrepWork {
  statute_id: string;
  prep_document_id: string;
  parliamentary_ref?: string;
  document_type?: string;
  title?: string;
  summary?: string;
}

/**
 * Fetch preparatory works for a given statute.
 */
async function fetchPrepWorks(statuteId: string): Promise<PrepWork[]> {
  console.log(`  Fetching preparatory works for ${statuteId}...`);

  // The DZ website search endpoint
  const url = `${DZ_BASE}/wps/portal/Home/zakonodaja/izbranZaworkskonodajniPostopek?uid=${statuteId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const works: PrepWork[] = [];

    // Extract document links from the parliamentary procedure page
    const docPattern = /EPA\s*(\d+-\w+)/g;
    let match: RegExpExecArray | null;

    while ((match = docPattern.exec(html)) !== null) {
      const ref = match[1];
      works.push({
        statute_id: statuteId,
        prep_document_id: `dz-${ref}`,
        parliamentary_ref: `EPA ${ref}`,
        document_type: 'predlog',
        title: `Zakonodajno gradivo EPA ${ref}`,
      });
    }

    console.log(`  Found ${works.length} preparatory works for ${statuteId}`);
    return works;
  } catch (error) {
    console.error(`  Error:`, error);
    return [];
  }
}

async function main(): Promise<void> {
  console.log('=== Preparatory Works Ingestion ===');
  console.log();

  ensureSeedDir();

  const statuteIds = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (statuteIds.length === 0) {
    console.log('Usage: npm run ingest:prep <statute-id> [<statute-id> ...]');
    process.exit(1);
  }

  const allWorks: PrepWork[] = [];
  const allDocs: Array<{ id: string; type: string; title: string; status: string }> = [];

  for (const statuteId of statuteIds) {
    const works = await fetchPrepWorks(statuteId);
    allWorks.push(...works);

    for (const w of works) {
      allDocs.push({
        id: w.prep_document_id,
        type: 'parliamentary',
        title: w.title ?? w.prep_document_id,
        status: 'in_force',
      });
    }

    await sleep(RATE_LIMIT_MS);
  }

  if (allWorks.length > 0) {
    const seedPath = path.join(SEED_DIR, 'preparatory-works.json');
    fs.writeFileSync(seedPath, JSON.stringify({ documents: allDocs, preparatory_works: allWorks }, null, 2), 'utf-8');
    console.log(`\nWrote preparatory-works.json (${allWorks.length} works)`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
