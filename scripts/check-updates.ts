#!/usr/bin/env tsx
/**
 * Check for updates to existing seed files.
 *
 * Compares local seed data with the current PIS portal to identify
 * statutes that may have been amended.
 *
 * Usage: npm run check:updates
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const PIS_BASE = 'http://www.pisrs.si/Pis.web';
const RATE_LIMIT_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('=== Check for Statute Updates ===');
  console.log();

  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found. Run ingestion first.');
    process.exit(0);
  }

  const seedFiles = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Checking ${seedFiles.length} seed files for updates...`);
  console.log();

  let updatesFound = 0;

  for (const file of seedFiles) {
    const filePath = path.join(SEED_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const seed = JSON.parse(raw);

    if (!seed.documents?.[0]?.id) continue;

    const statuteId = seed.documents[0].id;
    const localProvCount = seed.provisions?.length ?? 0;

    try {
      const response = await fetch(`${PIS_BASE}/${statuteId}`);
      if (!response.ok) continue;

      const html = await response.text();
      const articlePattern = /\d+\.\s*člen\b/g;
      let count = 0;
      while (articlePattern.exec(html)) count++;

      if (count !== localProvCount) {
        console.log(`  UPDATE: ${statuteId} — local: ${localProvCount} provisions, remote: ${count}`);
        updatesFound++;
      }
    } catch {
      // Skip on error
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log();
  console.log(`Done. ${updatesFound} statute(s) may need re-ingestion.`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
