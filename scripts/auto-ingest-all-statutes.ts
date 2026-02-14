#!/usr/bin/env tsx
/**
 * Comprehensive Slovenian statute ingestion script.
 *
 * Discovers statutes from the PIS portal and creates seed JSON files.
 *
 * Usage:
 *   npm run ingest:all                    # Ingest all key statutes
 *   npm run ingest:all -- --force         # Re-ingest existing statutes
 *   npm run ingest:all -- --limit 10      # Test mode: limit to 10 documents
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const FAILURE_LOG = path.resolve(__dirname, '..', 'data', 'ingest-failures.log');

const PIS_BASE = 'http://www.pisrs.si/Pis.web';
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;

// Key Slovenian statutes to ingest
const KEY_STATUTES = [
  'ustava-republike-slovenije',
  'zakon-o-kazenskem-postopku',
  'kazenski-zakonik',
  'obligacijski-zakonik',
  'zakon-o-pravdnem-postopku',
  'zakon-o-splosnem-upravnem-postopku',
  'zakon-o-delovnih-razmerjih',
  'zakon-o-pokojninskem-in-invalidskem-zavarovanju',
  'zakon-o-gospodarskih-druzbah',
  'zakon-o-lokalni-samoupravi',
  'zakon-o-javnem-narocanju',
  'zakon-o-varstvu-osebnih-podatkov',
  'zakon-o-upravnem-sporu',
  'zakon-o-sodiščih',
  'zakon-o-sodniski-sluzbi',
  'zakon-o-davcnem-postopku',
  'zakon-o-davku-na-dodano-vrednost',
  'zakon-o-davku-od-dohodkov-pravnih-oseb',
  'zakon-o-dohodnini',
  'stvarnopravni-zakonik',
  'zakon-o-zemljiski-knjigi',
  'zakon-o-izvrsbi-in-zavarovanju',
  'zakon-o-drzavni-upravi',
  'zakon-o-javnih-financah',
  'zakon-o-financnem-poslovanju-postopkih-zaradi-insolventnosti-in-prisilnem-prenehanju',
  'zakon-o-graditvi-objektov',
  'zakon-o-prostorskem-nacrtovanju',
  'zakon-o-varstvu-okolja',
  'zakon-o-vodah',
  'zakon-o-tujcih',
  'zakon-o-mednarodni-zasciti',
  'zakon-o-prekrskih',
  'zakon-o-zavodih',
  'zakon-o-javnih-usluzbenčih',
  'zakon-o-sistemu-plac-v-javnem-sektorju',
  'zakon-o-drzavnem-zboru',
  'zakon-o-vladi-republike-slovenije',
  'zakon-o-druzini',
  'zakon-o-dedovanju',
  'zakon-o-zemljiski-knjigi',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
}

function parseArgs(): { force: boolean; limit: number | null } {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force'),
    limit: args.includes('--limit')
      ? parseInt(args[args.indexOf('--limit') + 1], 10)
      : null,
  };
}

async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<Response | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      console.error(`  Attempt ${attempt}/${retries} failed: ${response.status}`);
    } catch (error) {
      console.error(`  Attempt ${attempt}/${retries} error:`, error);
    }
    if (attempt < retries) await sleep(RATE_LIMIT_MS);
  }
  return null;
}

async function ingestStatute(statuteId: string, force: boolean): Promise<boolean> {
  const seedPath = path.join(SEED_DIR, `${statuteId}.json`);

  if (!force && fs.existsSync(seedPath)) {
    console.log(`  Skipping ${statuteId} (already exists, use --force to re-ingest)`);
    return true;
  }

  const url = `${PIS_BASE}/${statuteId}`;
  console.log(`  Fetching ${statuteId}...`);

  const response = await fetchWithRetry(url);
  if (!response) {
    return false;
  }

  const html = await response.text();

  // Extract title
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : statuteId;

  // Extract short name
  const shortNameMatch = html.match(/\(([A-ZČŠŽ][A-ZČŠŽ0-9-]+(?:-\d+)?)\)/);
  const short_name = shortNameMatch ? shortNameMatch[1] : undefined;

  // Determine status
  let status = 'in_force';
  if (/prenehal\s+veljati/i.test(html) || /razveljavljen/i.test(html)) {
    status = 'repealed';
  }

  // Parse provisions
  const provisions: Array<{ provision_ref: string; article: string; title?: string; content: string }> = [];
  const articlePattern = /(\d+)\.\s*člen\b(.*?)(?=\d+\.\s*člen\b|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = articlePattern.exec(html)) !== null) {
    const content = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    if (content.length > 0) {
      provisions.push({
        provision_ref: match[1],
        article: match[1],
        content,
      });
    }
  }

  const seedData = {
    documents: [{
      id: statuteId,
      type: 'statute',
      title,
      short_name,
      status,
      url,
    }],
    provisions: provisions.map((p) => ({ document_id: statuteId, ...p })),
  };

  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`  Wrote ${statuteId}.json (${provisions.length} provisions)`);
  return true;
}

async function main(): Promise<void> {
  console.log('=== Comprehensive Slovenian Statute Ingestion ===');
  console.log();

  const { force, limit } = parseArgs();
  ensureSeedDir();

  const statutes = limit ? KEY_STATUTES.slice(0, limit) : KEY_STATUTES;
  console.log(`Ingesting ${statutes.length} statutes (force=${force})...`);
  console.log();

  let success = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const statuteId of statutes) {
    const ok = await ingestStatute(statuteId, force);
    if (ok) {
      success++;
    } else {
      failed++;
      failures.push(statuteId);
    }
    await sleep(RATE_LIMIT_MS);
  }

  if (failures.length > 0) {
    fs.writeFileSync(FAILURE_LOG, failures.join('\n') + '\n', 'utf-8');
    console.log(`\nFailure log written to ${FAILURE_LOG}`);
  }

  console.log();
  console.log(`Done. Success: ${success}, Failed: ${failed}, Total: ${statutes.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
