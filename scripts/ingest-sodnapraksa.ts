#!/usr/bin/env tsx
/**
 * sodnapraksa.si case law ingestion script.
 *
 * Scrapes the public search interface of the Slovenian court decision
 * database, fetches individual case pages for metadata (ECLI, summary,
 * keywords), and writes seed JSON to data/seed/case-law.json.
 *
 * Usage: npm run ingest:cases [-- --limit N] [-- --court CODE]
 *
 * The data is publicly available for reuse per the site's terms,
 * with attribution to "Vrhovno sodišče Republike Slovenije".
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const BASE_URL = 'https://www.sodnapraksa.si/';
const RATE_LIMIT_MS = 1500;

// Database codes used in the public search interface
const DATABASE_CODES = ['SOVS', 'IESP', 'VDSS', 'UPRS'] as const;

// Map database codes to human-readable court names
const DATABASE_LABELS: Record<string, string> = {
  SOVS: 'Vrhovno sodišče RS',
  IESP: 'Višja sodišča',
  VDSS: 'Višje delovno in socialno sodišče',
  UPRS: 'Upravno sodišče RS',
};

// Search queries covering key legal domains for a representative sample
const SEARCH_QUERIES = [
  'varstvo osebnih podatkov',      // data protection
  'ustavna pravica',               // constitutional rights
  'delovno razmerje',              // employment law
  'odškodnina',                    // damages/compensation
  'kaznivo dejanje',               // criminal offence
  'davčni postopek',               // tax procedure
  'insolvenčni postopek',          // insolvency
  'javno naročanje',               // public procurement
  'varstvo potrošnikov',           // consumer protection
  'avtorska pravica',              // copyright
  'okoljsko pravo',                // environmental law
  'gradbeno dovoljenje',           // building permit
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureSeedDir(): void {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }
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
 * Extract document IDs from a search results page.
 * The search page contains links with &id=NNNN parameters.
 */
function extractDocumentIds(html: string): string[] {
  const idPattern = /(?:&amp;|[&?])id=(\d+)/g;
  const ids: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = idPattern.exec(html)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Extract a value using a simple regex, returning undefined on no match.
 */
function extractField(html: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(html);
  return match?.[1]?.trim() || undefined;
}

/**
 * Clean HTML: strip tags and decode basic entities.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a single case detail page and extract structured data.
 */
function parseCaseDetail(html: string, docId: string): CaseDecision | null {
  // ECLI is the most reliable identifier
  const ecli = extractField(html, /ECLI[:\s]*(ECLI:SI:[A-Z]+:\d{4}:[A-Z0-9.]+)/i);

  // Case number from the title or heading
  const caseNumber = extractField(html, /(?:opravilna\s+(?:številka|št\.?)|Sodba|Sklep|Odločba)\s+([A-Z]{1,4}\s+(?:Ips|Cp|Cpg|I\s+U|II\s+U|III\s+U|IV\s+U)\s+[\d/]+)/i)
    || extractField(html, /((?:Sodba|Sklep|Odločba)\s+[A-Z0-9\s./]+\d{4})/i);

  // Court name
  const court = extractField(html, /(?:Sodišče|sodišče)[:\s]*([^<\n]+)/i)
    || extractField(html, /(Vrhovno sodišče|Višje sodišče|Upravno sodišče|Višje delovno)[^<]*/i)
    || 'UNKNOWN';

  // Decision date in DD.MM.YYYY format
  const rawDate = extractField(html, /(?:Datum\s+odločbe|Datum)[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i);
  const decisionDate = rawDate ? convertDate(rawDate) : undefined;

  // Legal domain / department
  const legalDomain = extractField(html, /(?:Področje|Oddelek)[:\s]*([^<\n]+)/i);

  // Procedure type (from case number prefix)
  const procedureType = inferProcedureType(caseNumber);

  // Summary / core holding (jedro)
  let summary: string | undefined;
  const jedroMatch = html.match(/(?:Jedro|jedro|Izvleček)[:\s]*<[^>]*>([\s\S]{10,2000}?)(?:<\/(?:div|p|td)>)/i);
  if (jedroMatch) {
    summary = stripHtml(jedroMatch[1]).slice(0, 1000);
  }

  // Keywords (ključne besede or institut)
  const keywordsMatch = html.match(/(?:Institut|ključne besede)[:\s]*<[^>]*>([\s\S]{5,500}?)(?:<\/(?:div|p|td)>)/i);
  const keywords = keywordsMatch ? stripHtml(keywordsMatch[1]).slice(0, 500) : undefined;

  if (!ecli && !caseNumber) return null;

  const documentId = ecli
    ? `case-${ecli.replace(/:/g, '-')}`
    : `case-sodnapraksa-${docId}`;

  return {
    document_id: documentId,
    court: court.trim(),
    ecli,
    case_number: caseNumber,
    decision_date: decisionDate,
    procedure_type: procedureType,
    legal_domain: legalDomain,
    summary,
    keywords,
  };
}

function convertDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('.');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function inferProcedureType(caseNumber?: string): string | undefined {
  if (!caseNumber) return undefined;
  if (/\bIps\b/i.test(caseNumber)) return 'revizija';
  if (/\bCpg?\b/i.test(caseNumber)) return 'pritožba';
  if (/\bU\b/i.test(caseNumber)) return 'upravni spor';
  if (/\bKp\b/i.test(caseNumber)) return 'kazenski postopek';
  return undefined;
}

/**
 * Fetch a single page and return its HTML, or null on failure.
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SlovenianLawMCP/1.0 (legal-research; attribution: Vrhovno sodišče RS)',
        'Accept': 'text/html',
        'Accept-Language': 'sl',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Search and collect document IDs from the public search interface.
 */
async function collectDocumentIds(
  database: string,
  query: string,
  maxResults: number,
): Promise<string[]> {
  const allIds: string[] = [];
  const perPage = 20;
  const maxPages = Math.ceil(maxResults / perPage);

  for (let page = 0; page < maxPages && allIds.length < maxResults; page++) {
    const params = new URLSearchParams({
      q: query,
      [`database[${database}]`]: database,
      _submit: 'išči',
      rowsPerPage: String(perPage),
      page: String(page),
    });

    const url = `${BASE_URL}?${params.toString()}`;
    const html = await fetchPage(url);
    if (!html) break;

    const ids = extractDocumentIds(html);
    if (ids.length === 0) break;

    allIds.push(...ids);
    await sleep(RATE_LIMIT_MS);
  }

  return allIds.slice(0, maxResults);
}

async function main(): Promise<void> {
  console.log('=== Slovenian Case Law Ingestion ===');
  console.log(`Attribution: Javne informacije Slovenije, Vrhovno sodišče RS`);
  console.log();

  ensureSeedDir();

  const args = process.argv.slice(2);
  const perQuery = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1], 10)
    : 5;  // cases per query per database
  const dbFilter = args.includes('--court')
    ? args[args.indexOf('--court') + 1]
    : null;

  const databases = dbFilter
    ? [dbFilter]
    : DATABASE_CODES as unknown as string[];

  const allCases: CaseDecision[] = [];
  const seenIds = new Set<string>();
  let fetchedDetails = 0;

  for (const db of databases) {
    console.log(`\n--- Database: ${db} (${DATABASE_LABELS[db] ?? db}) ---`);

    for (const query of SEARCH_QUERIES) {
      console.log(`  Search: "${query}"...`);
      const docIds = await collectDocumentIds(db, query, perQuery);
      console.log(`    Found ${docIds.length} document IDs`);

      for (const docId of docIds) {
        if (seenIds.has(docId)) continue;
        seenIds.add(docId);

        // Fetch individual case detail page
        const params = new URLSearchParams({
          q: query,
          [`database[${db}]`]: db,
          _submit: 'išči',
          rowsPerPage: '20',
          page: '0',
          id: docId,
        });
        const detailUrl = `${BASE_URL}?${params.toString()}`;
        const html = await fetchPage(detailUrl);
        if (!html) {
          console.log(`    Skipped ${docId} (fetch failed)`);
          continue;
        }

        const caseData = parseCaseDetail(html, docId);
        if (caseData) {
          allCases.push(caseData);
          fetchedDetails++;
          const label = caseData.ecli ?? caseData.case_number ?? docId;
          console.log(`    [${fetchedDetails}] ${label}`);
        }

        await sleep(RATE_LIMIT_MS);
      }
    }
  }

  if (allCases.length === 0) {
    console.log('\nNo cases found.');
    return;
  }

  // Write seed file
  const seedData = {
    documents: allCases.map((c) => ({
      id: c.document_id,
      type: 'case_law' as const,
      title: c.ecli ?? c.case_number ?? c.document_id,
      status: 'in_force',
      url: c.ecli
        ? `https://www.sodnapraksa.si/?q=&database%5BSOVS%5D=SOVS&_submit=i%C5%A1%C4%8Di&rowsPerPage=20&page=0&id=${c.document_id.replace('case-sodnapraksa-', '')}`
        : undefined,
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
