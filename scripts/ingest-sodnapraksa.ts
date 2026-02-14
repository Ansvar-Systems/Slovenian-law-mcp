#!/usr/bin/env tsx
/**
 * sodnapraksa.si case law ingestion script.
 *
 * Fetches Slovenian court decisions from the open data portal,
 * parses the response, and writes seed JSON files to data/seed/.
 *
 * Usage: npm run ingest:cases
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');

const API_BASE = 'http://www.sodnapraksa.si';
const RATE_LIMIT_MS = 1000;

// Slovenian court codes
const COURTS = ['USRS', 'VSRS', 'VSL', 'VSM', 'VSK', 'VSC', 'UPRS', 'VDSS'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
}

/**
 * Derive court code from ECLI string.
 * Format: ECLI:SI:<COURT>:<YEAR>:<NUMBER>
 */
function courtFromEcli(ecli: string): string {
  const parts = ecli.split(':');
  if (parts.length >= 4) {
    return parts[2];
  }
  return 'UNKNOWN';
}

interface CaseDecision {
  document_id: string;
  court: string;
  ecli?: string;
  case_number?: string;
  decision_date?: string;
  procedure_type?: string;
  legal_domain?: string;
  summary?: string;
  keywords?: string;
}

/**
 * Fetch cases for a specific court from sodnapraksa.si.
 * Note: The actual API structure will need to be adapted based on
 * the live API response format.
 */
async function fetchCasesForCourt(
  court: string,
  limit: number,
): Promise<CaseDecision[]> {
  console.log(`  Fetching cases for court: ${court}...`);

  // sodnapraksa.si search endpoint
  const url = `${API_BASE}/znanje/vsrs/search?q=*&sodisce=${court}&rows=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed to fetch ${court}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const cases: CaseDecision[] = [];

    // Parse ECLI entries from response
    const ecliPattern = /ECLI:SI:[A-Z]+:\d{4}:\w+/g;
    let match: RegExpExecArray | null;
    const seenEclis = new Set<string>();

    while ((match = ecliPattern.exec(html)) !== null) {
      const ecli = match[0];
      if (seenEclis.has(ecli)) continue;
      seenEclis.add(ecli);

      cases.push({
        document_id: `case-${ecli.replace(/:/g, '-')}`,
        court: courtFromEcli(ecli),
        ecli,
        summary: '',
        keywords: '',
      });
    }

    console.log(`  Found ${cases.length} cases for ${court}`);
    return cases;
  } catch (error) {
    console.error(`  Error fetching ${court}:`, error);
    return [];
  }
}

async function main(): Promise<void> {
  console.log('=== Slovenian Case Law Ingestion ===');
  console.log();

  ensureSeedDir();

  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : 100;
  const courtFilter = args.includes('--court')
    ? args[args.indexOf('--court') + 1]
    : null;

  const courts = courtFilter ? [courtFilter] : COURTS;
  const allCases: CaseDecision[] = [];

  for (const court of courts) {
    const cases = await fetchCasesForCourt(court, limit);
    allCases.push(...cases);
    await sleep(RATE_LIMIT_MS);
  }

  if (allCases.length === 0) {
    console.log('No cases found.');
    return;
  }

  // Write all case law documents
  const seedData = {
    documents: allCases.map((c) => ({
      id: c.document_id,
      type: 'case_law' as const,
      title: c.ecli ?? c.case_number ?? c.document_id,
      status: 'in_force',
      url: c.ecli ? `${API_BASE}/znanje/vsrs/odlocitev/${c.ecli}` : undefined,
    })),
    case_law: allCases,
  };

  const seedPath = path.join(SEED_DIR, 'case-law.json');
  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`\nWrote case-law.json (${allCases.length} decisions)`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
