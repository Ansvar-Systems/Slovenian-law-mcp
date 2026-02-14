#!/usr/bin/env tsx
/**
 * PIS (pisrs.si) statute ingestion script.
 *
 * Fetches Slovenian statutes from the PIS web portal, parses the HTML
 * content, and writes seed JSON files to data/seed/.
 *
 * Usage: npm run ingest
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PIS_BASE = 'http://www.pisrs.si/Pis.web';
const RATE_LIMIT_MS = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
}

interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section?: string;
  article: string;
  title?: string;
  content: string;
}

interface ParsedStatute {
  id: string;
  title: string;
  short_name?: string;
  status: string;
  issued_date?: string;
  in_force_date?: string;
  url: string;
  provisions: ParsedProvision[];
}

/**
 * Parse article content from PIS HTML.
 * This is a simplified parser — the actual PIS HTML structure will need
 * to be adapted based on the live site format.
 */
function parseArticlesFromHtml(html: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  // Pattern: article blocks typically start with "NN. člen"
  const articlePattern = /(\d+)\.\s*člen\b(.*?)(?=\d+\.\s*člen\b|$)/gs;
  let match: RegExpExecArray | null;

  while ((match = articlePattern.exec(html)) !== null) {
    const articleNum = match[1];
    const rawContent = match[2].trim();

    // Strip HTML tags for content
    const content = rawContent
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (content.length > 0) {
      // Try to extract title (first line if short enough)
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0] && lines[0].length < 200 ? lines[0] : undefined;

      provisions.push({
        provision_ref: articleNum,
        article: articleNum,
        title: title !== content ? title : undefined,
        content,
      });
    }
  }

  return provisions;
}

/**
 * Fetch and parse a single statute from PIS.
 */
async function fetchStatute(statuteId: string): Promise<ParsedStatute | null> {
  const url = `${PIS_BASE}/${statuteId}`;
  console.log(`  Fetching ${url}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed to fetch ${statuteId}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract title from page
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : statuteId;

    // Extract short name
    const shortNameMatch = html.match(/\(([A-ZČŠŽ][A-ZČŠŽ0-9-]+(?:-\d+)?)\)/);
    const short_name = shortNameMatch ? shortNameMatch[1] : undefined;

    // Determine status
    let status = 'in_force';
    if (/prenehal\s+veljati/i.test(html) || /razveljavljen/i.test(html)) {
      status = 'repealed';
    }

    const provisions = parseArticlesFromHtml(html);

    return {
      id: statuteId,
      title,
      short_name,
      status,
      url,
      provisions,
    };
  } catch (error) {
    console.error(`  Error fetching ${statuteId}:`, error);
    return null;
  }
}

/**
 * Write a parsed statute to a seed JSON file.
 */
function writeSeedFile(statute: ParsedStatute): void {
  const seedData = {
    documents: [
      {
        id: statute.id,
        type: 'statute',
        title: statute.title,
        short_name: statute.short_name,
        status: statute.status,
        issued_date: statute.issued_date,
        in_force_date: statute.in_force_date,
        url: statute.url,
      },
    ],
    provisions: statute.provisions.map((p) => ({
      document_id: statute.id,
      ...p,
    })),
  };

  const filename = `${statute.id}.json`;
  const filePath = path.join(SEED_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`  Wrote ${filename} (${statute.provisions.length} provisions)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== PIS Statute Ingestion ===');
  console.log();

  ensureSeedDir();

  // Get statute IDs from command line args or use defaults
  const args = process.argv.slice(2);
  let statuteIds: string[];

  if (args.length > 0 && !args[0].startsWith('--')) {
    statuteIds = args;
  } else {
    console.log('No statute IDs provided. Usage: npm run ingest <statute-id> [<statute-id> ...]');
    console.log('Example: npm run ingest zakon-o-kazenskem-postopku obligacijski-zakonik');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const statuteId of statuteIds) {
    const statute = await fetchStatute(statuteId);
    if (statute) {
      writeSeedFile(statute);
      successCount++;
    } else {
      failCount++;
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log();
  console.log(`Done. Success: ${successCount}, Failed: ${failCount}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
