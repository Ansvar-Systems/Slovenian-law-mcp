#!/usr/bin/env tsx
/**
 * PIS (pisrs.si) statute ingestion script.
 *
 * Fetches Slovenian statutes from the PIS internal API, parses the structured
 * JSON response, and writes seed JSON files to data/seed/.
 *
 * Usage:
 *   npm run ingest ZAKO5050                  # Ingest by PIS zunanji ID
 *   npm run ingest ZAKO5050 USTA1 ZAKO4748   # Multiple statutes
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

const PIS_API = 'https://pisrs.si/api';
const RATE_LIMIT_MS = 1500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PISEvidencniPodatki {
  zbirkaElementID: number;
  naslov: string;
  naslovAng: string | null;
  kratica: string | null;
  zunanjiID: string;
  vrstaAkta: string;
  sop: string | null;
  eva: string | null;
  epa: string | null;
  sprejeto: string | null;
  objavljeno: string | null;
  veljaOd: string | null;
  veljaDo: string | null;
  semafor: { id: number; naziv: string } | null;
}

interface PISNpbVersion {
  id: number;
  naziv: string;
  datumZacetkaUporabe: string | null;
}

interface PISContentBlock {
  id: number;
  vsebina: string;
  struktura: string;
  css: string | null;
}

interface ParsedProvision {
  document_id: string;
  provision_ref: string;
  chapter?: string;
  section?: string;
  article: string;
  title?: string;
  content: string;
}

interface SeedData {
  documents: Array<{
    id: string;
    type: string;
    title: string;
    title_en?: string;
    short_name?: string;
    status: string;
    issued_date?: string;
    in_force_date?: string;
    url: string;
  }>;
  provisions: ParsedProvision[];
}

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

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').trim();
}

function mapStatus(semafor: { id: number; naziv: string } | null, veljaDo: string | null): string {
  if (!semafor) return 'in_force';
  const name = semafor.naziv.toLowerCase();
  if (name.includes('veljaven') && !name.includes('neveljaven')) return 'in_force';
  if (name.includes('neveljaven')) return veljaDo ? 'repealed' : 'amended';
  if (name.includes('prenehal')) return 'repealed';
  if (name.includes('sprejet') || name.includes('objavljen')) return 'not_yet_in_force';
  return 'in_force';
}

function mapDocType(vrstaAkta: string): string {
  const lower = vrstaAkta.toLowerCase();
  if (lower === 'ustava') return 'constitutional';
  if (lower === 'zakon') return 'statute';
  if (lower === 'uredba') return 'regulation';
  if (lower === 'odlok' || lower === 'sklep') return 'decree';
  if (lower.includes('pravilnik') || lower.includes('navodilo')) return 'regulation';
  return 'statute';
}

// ---------------------------------------------------------------------------
// API Calls
// ---------------------------------------------------------------------------

async function fetchStatuteMetadata(zunanjiId: string): Promise<{
  evidencniPodatki: PISEvidencniPodatki;
  besedilo?: { npbVerzije?: PISNpbVersion[] };
} | null> {
  const url = `${PIS_API}/rezultat/zbirka/id/${zunanjiId}`;
  console.log(`  Fetching metadata: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  Failed: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json() as { data: any };
    return json.data;
  } catch (err) {
    console.error(`  Error fetching metadata:`, err);
    return null;
  }
}

async function fetchNpbText(npbId: number): Promise<PISContentBlock[]> {
  const url = `${PIS_API}/rezultat/neuradno-precisceno-besedilo/${npbId}/details`;
  console.log(`  Fetching NPB text: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  Failed: HTTP ${res.status}`);
      return [];
    }
    const json = await res.json() as { data: { besedilo: PISContentBlock[] } };
    return json.data?.besedilo ?? [];
  } catch (err) {
    console.error(`  Error fetching NPB text:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Content Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the structured content blocks from PIS into provisions.
 *
 * The content blocks follow this pattern:
 *   poglavje   → chapter (e.g., "Prvo poglavje<br /> TEMELJNE DOLOČBE")
 *   oddelek    → section (e.g., "1. Osebna veljavnost")
 *   clen       → alternates: title, then article number (e.g., "1. člen")
 *   odstavek   → paragraph content
 *   stevilcna_tocka, alinea_*, etc. → sub-content
 */
function parseContentBlocks(blocks: PISContentBlock[], documentId: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  let currentArticleTitle: string | null = null;
  let currentArticleNum: string | null = null;
  let currentContent: string[] = [];

  function flushArticle(): void {
    if (currentArticleNum && currentContent.length > 0) {
      provisions.push({
        document_id: documentId,
        provision_ref: currentArticleNum,
        chapter: currentChapter ?? undefined,
        section: currentSection ?? undefined,
        article: currentArticleNum,
        title: currentArticleTitle ?? undefined,
        content: currentContent.join('\n').trim(),
      });
    }
    currentContent = [];
  }

  // A pending title that hasn't been matched to an article number yet
  let pendingTitle: string | null = null;

  for (const block of blocks) {
    const text = stripHtml(block.vsebina);
    if (!text) continue;

    switch (block.struktura) {
      case 'del':
      case 'poglavje': {
        flushArticle();
        currentChapter = text.replace(/\n/g, ' ').trim();
        currentSection = null;
        pendingTitle = null;
        break;
      }

      case 'oddelek': {
        flushArticle();
        currentSection = text;
        pendingTitle = null;
        break;
      }

      case 'clen': {
        // Check if this is an article number (e.g., "1. člen", "3.a člen")
        const articleNumMatch = text.match(/^(\d+(?:\.[a-z])?)[\.\s]*člen/i);

        if (articleNumMatch) {
          // This is an article number — flush previous article and start new
          flushArticle();
          currentArticleNum = articleNumMatch[1];
          // If there was a preceding title clen, use it
          currentArticleTitle = pendingTitle;
          pendingTitle = null;
        } else {
          // No article number pattern — this is a title for the next article
          pendingTitle = text;
        }
        break;
      }

      case 'naslov':
      case 'opozorilo':
      case 'npb':
      case 'napaka':
        break;

      default: {
        if (currentArticleNum) {
          currentContent.push(text);
        }
        break;
      }
    }
  }

  // Flush the last article
  flushArticle();

  return provisions;
}

// ---------------------------------------------------------------------------
// Main Ingestion
// ---------------------------------------------------------------------------

async function ingestStatute(zunanjiId: string): Promise<boolean> {
  console.log(`\nIngesting ${zunanjiId}...`);

  // 1. Fetch metadata
  const data = await fetchStatuteMetadata(zunanjiId);
  if (!data) return false;

  const ep = data.evidencniPodatki;
  console.log(`  Title: ${ep.naslov}`);
  console.log(`  Type: ${ep.vrstaAkta}, Abbreviation: ${ep.kratica ?? 'N/A'}`);

  // 2. Find the latest NPB version
  const npbVersions = data.besedilo?.npbVerzije ?? [];
  let provisions: ParsedProvision[] = [];

  if (npbVersions.length > 0) {
    // Find the highest NPB number (latest consolidated version)
    const latestNpb = npbVersions.reduce((best, v) => {
      const numMatch = v.naziv.match(/NPB\s+(\d+)/);
      const bestMatch = best.naziv.match(/NPB\s+(\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : 0;
      const bestNum = bestMatch ? parseInt(bestMatch[1], 10) : 0;
      return num > bestNum ? v : best;
    }, npbVersions[0]);

    console.log(`  Using NPB version: ${latestNpb.naziv} (ID: ${latestNpb.id})`);

    await sleep(500);
    const blocks = await fetchNpbText(latestNpb.id);
    console.log(`  Content blocks: ${blocks.length}`);

    if (blocks.length > 0) {
      provisions = parseContentBlocks(blocks, zunanjiId);
    }
  } else {
    console.log(`  No NPB versions found — statute may not have consolidated text`);
  }

  // 3. Build seed data
  const status = mapStatus(ep.semafor, ep.veljaDo);
  const docType = mapDocType(ep.vrstaAkta);

  const seedData: SeedData = {
    documents: [{
      id: zunanjiId,
      type: docType,
      title: ep.naslov,
      title_en: ep.naslovAng ?? undefined,
      short_name: ep.kratica ?? undefined,
      status,
      issued_date: ep.objavljeno ?? ep.sprejeto ?? undefined,
      in_force_date: ep.veljaOd ?? undefined,
      url: `https://pisrs.si/pregledPredpisa?id=${zunanjiId}`,
    }],
    provisions,
  };

  // 4. Write seed file
  const seedPath = path.join(SEED_DIR, `${zunanjiId}.json`);
  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`  Wrote ${zunanjiId}.json (${provisions.length} provisions)`);

  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== PIS Statute Ingestion (API) ===');
  console.log();

  ensureSeedDir();

  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

  if (args.length === 0) {
    console.log('No statute IDs provided.');
    console.log('Usage: npm run ingest <ZUNANJI_ID> [<ZUNANJI_ID> ...]');
    console.log('Example: npm run ingest ZAKO5050 USTA1');
    process.exit(1);
  }

  let success = 0;
  let failed = 0;

  for (const id of args) {
    const ok = await ingestStatute(id);
    if (ok) success++;
    else failed++;
    if (args.indexOf(id) < args.length - 1) await sleep(RATE_LIMIT_MS);
  }

  console.log();
  console.log(`Done. Success: ${success}, Failed: ${failed}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
