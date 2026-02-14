#!/usr/bin/env tsx
/**
 * Comprehensive Slovenian statute ingestion script.
 *
 * Uses the PIS internal API to fetch metadata and consolidated text (NPB)
 * for key Slovenian statutes. Writes seed JSON files consumed by build-db.ts.
 *
 * Usage:
 *   npm run ingest:all                    # Ingest all key statutes
 *   npm run ingest:all -- --force         # Re-ingest existing statutes
 *   npm run ingest:all -- --limit 5       # Test mode: limit to 5 statutes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '..', 'data', 'seed');
const FAILURE_LOG = path.resolve(__dirname, '..', 'data', 'ingest-failures.log');

const PIS_API = 'https://pisrs.si/api';
const RATE_LIMIT_MS = 1500;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Key Slovenian statutes — PIS zunanji IDs with human-readable names
// ---------------------------------------------------------------------------

const KEY_STATUTES: Array<{ id: string; name: string }> = [
  // Constitutional
  { id: 'USTA1', name: 'Ustava RS (URS)' },

  // Criminal
  { id: 'ZAKO5050', name: 'Kazenski zakonik (KZ-1)' },
  { id: 'ZAKO362', name: 'Zakon o kazenskem postopku (ZKP)' },
  { id: 'ZAKO2537', name: 'Zakon o prekrških (ZP-1)' },

  // Civil / Obligations
  { id: 'ZAKO1263', name: 'Obligacijski zakonik (OZ)' },
  { id: 'ZAKO3242', name: 'Stvarnopravni zakonik (SPZ)' },
  { id: 'ZAKO317', name: 'Zakon o dedovanju (ZD)' },
  { id: 'ZAKO7556', name: 'Družinski zakonik (DZ)' },

  // Procedural
  { id: 'ZAKO1212', name: 'Zakon o pravdnem postopku (ZPP)' },
  { id: 'ZAKO1008', name: 'Zakon o izvršbi in zavarovanju (ZIZ)' },
  { id: 'ZAKO4732', name: 'Zakon o upravnem sporu (ZUS-1)' },
  { id: 'ZAKO1603', name: 'Zakon o splošnem upravnem postopku (ZUP)' },

  // Commercial / Corporate
  { id: 'ZAKO4291', name: 'Zakon o gospodarskih družbah (ZGD-1)' },
  { id: 'ZAKO4735', name: 'Zakon o finančnem poslovanju (ZFPPIPP)' },

  // Labour
  { id: 'ZAKO5944', name: 'Zakon o delovnih razmerjih (ZDR-1)' },
  { id: 'ZAKO5840', name: 'Zakon o urejanju trga dela (ZUTD)' },

  // Administrative
  { id: 'ZAKO307', name: 'Zakon o lokalni samoupravi (ZLS)' },
  { id: 'ZAKO3177', name: 'Zakon o javnih uslužbencih (ZJU)' },
  { id: 'ZAKO3225', name: 'Zakon o državni upravi (ZDU-1)' },

  // Tax
  { id: 'ZAKO4703', name: 'Zakon o davčnem postopku (ZDavP-2)' },
  { id: 'ZAKO4701', name: 'Zakon o davku na dodano vrednost (ZDDV-1)' },
  { id: 'ZAKO4697', name: 'Zakon o dohodnini (ZDoh-2)' },
  { id: 'ZAKO4687', name: 'Zakon o davku od dohodkov pravnih oseb (ZDDPO-2)' },

  // Data protection
  { id: 'ZAKO7959', name: 'Zakon o varstvu osebnih podatkov (ZVOP-2)' },

  // Environmental / Construction
  { id: 'ZAKO8286', name: 'Zakon o varstvu okolja (ZVO-2)' },
  { id: 'ZAKO8249', name: 'Zakon o urejanju prostora (ZUreP-3)' },

  // Other key statutes
  { id: 'ZAKO7086', name: 'Zakon o javnem naročanju (ZJN-3)' },
  { id: 'ZAKO1608', name: 'Zakon o medijih (ZMed)' },
  { id: 'ZAKO6183', name: 'Zakon o zavarovalništvu (ZZavar-1)' },
  { id: 'ZAKO8319', name: 'Zakon o bančništvu (ZBan-3)' },
  { id: 'ZAKO7571', name: 'Zakon o trgu finančnih instrumentov (ZTFI-1)' },

  // Social security
  { id: 'ZAKO6280', name: 'Zakon o pokojninskem in invalidskem zavarovanju (ZPIZ-2)' },

  // Courts / Judiciary
  { id: 'ZAKO332', name: 'Zakon o sodiščih (ZS)' },
  { id: 'ZAKO334', name: 'Zakon o sodniški službi (ZSS)' },
  { id: 'ZAKO5812', name: 'Zakon o državnem tožilstvu (ZDT-1)' },

  // Land / Real property
  { id: 'ZAKO3603', name: 'Zakon o zemljiški knjigi (ZZK-1)' },

  // Foreign nationals / International protection
  { id: 'ZAKO5761', name: 'Zakon o tujcih (ZTuj-2)' },
  { id: 'ZAKO7103', name: 'Zakon o mednarodni zaščiti (ZMZ-1)' },

  // Public finance
  { id: 'ZAKO1227', name: 'Zakon o javnih financah (ZJF)' },
  { id: 'ZAKO2550', name: 'Zakon o računskem sodišču (ZRacS-1)' },
];

// ---------------------------------------------------------------------------
// Types (same as ingest-pis.ts)
// ---------------------------------------------------------------------------

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

function parseArgs(): { force: boolean; limit: number | null } {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force'),
    limit: args.includes('--limit')
      ? parseInt(args[args.indexOf('--limit') + 1], 10)
      : null,
  };
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
  return 'in_force';
}

function mapDocType(vrstaAkta: string): string {
  const lower = vrstaAkta.toLowerCase();
  if (lower === 'ustava') return 'constitutional';
  if (lower === 'zakon') return 'statute';
  if (lower === 'uredba') return 'regulation';
  if (lower === 'odlok' || lower === 'sklep') return 'decree';
  return 'statute';
}

async function fetchJson(url: string): Promise<any | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      console.error(`  Attempt ${attempt}/${MAX_RETRIES} HTTP ${res.status}`);
    } catch (err) {
      console.error(`  Attempt ${attempt}/${MAX_RETRIES} error:`, err);
    }
    if (attempt < MAX_RETRIES) await sleep(RATE_LIMIT_MS);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Content Parsing (identical to ingest-pis.ts)
// ---------------------------------------------------------------------------

function parseContentBlocks(blocks: PISContentBlock[], documentId: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  let currentArticleTitle: string | null = null;
  let currentArticleNum: string | null = null;
  let currentContent: string[] = [];
  let pendingTitle: string | null = null;

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
        const articleNumMatch = text.match(/^(\d+(?:\.[a-z])?)[\.\s]*člen/i);
        if (articleNumMatch) {
          flushArticle();
          currentArticleNum = articleNumMatch[1];
          currentArticleTitle = pendingTitle;
          pendingTitle = null;
        } else {
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

  flushArticle();
  return provisions;
}

// ---------------------------------------------------------------------------
// Single statute ingestion
// ---------------------------------------------------------------------------

async function ingestStatute(zunanjiId: string, label: string, force: boolean): Promise<boolean> {
  const seedPath = path.join(SEED_DIR, `${zunanjiId}.json`);

  if (!force && fs.existsSync(seedPath)) {
    console.log(`  Skipping ${zunanjiId} (${label}) — already exists`);
    return true;
  }

  console.log(`  Fetching ${zunanjiId} (${label})...`);

  // 1. Metadata
  const metaJson = await fetchJson(`${PIS_API}/rezultat/zbirka/id/${zunanjiId}`);
  if (!metaJson?.data) {
    console.error(`    Failed to fetch metadata`);
    return false;
  }

  const ep = metaJson.data.evidencniPodatki;
  const npbVersions = metaJson.data.besedilo?.npbVerzije ?? [];

  // 2. Full text
  let provisions: ParsedProvision[] = [];

  if (npbVersions.length > 0) {
    const latestNpb = npbVersions.reduce((best: any, v: any) => {
      const numMatch = v.naziv.match(/NPB\s+(\d+)/);
      const bestMatch = best.naziv.match(/NPB\s+(\d+)/);
      const num = numMatch ? parseInt(numMatch[1], 10) : 0;
      const bestNum = bestMatch ? parseInt(bestMatch[1], 10) : 0;
      return num > bestNum ? v : best;
    }, npbVersions[0]);

    await sleep(500);
    const textJson = await fetchJson(`${PIS_API}/rezultat/neuradno-precisceno-besedilo/${latestNpb.id}/details`);
    const blocks: PISContentBlock[] = textJson?.data?.besedilo ?? [];

    if (blocks.length > 0) {
      provisions = parseContentBlocks(blocks, zunanjiId);
    }
  }

  // 3. Write seed
  const status = mapStatus(ep.semafor, ep.veljaDo);
  const docType = mapDocType(ep.vrstaAkta);

  const seedData = {
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

  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf-8');
  console.log(`    Wrote ${zunanjiId}.json (${provisions.length} provisions)`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Comprehensive Slovenian Statute Ingestion (API) ===');
  console.log();

  const { force, limit } = parseArgs();
  ensureSeedDir();

  // De-duplicate by ID (some entries may share IDs)
  const seen = new Set<string>();
  const statutes = KEY_STATUTES.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  const toIngest = limit ? statutes.slice(0, limit) : statutes;
  console.log(`Ingesting ${toIngest.length} statutes (force=${force})...`);
  console.log();

  let success = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const statute of toIngest) {
    const ok = await ingestStatute(statute.id, statute.name, force);
    if (ok) {
      success++;
    } else {
      failed++;
      failures.push(`${statute.id} (${statute.name})`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  if (failures.length > 0) {
    fs.writeFileSync(FAILURE_LOG, failures.join('\n') + '\n', 'utf-8');
    console.log(`\nFailure log written to ${FAILURE_LOG}`);
  }

  console.log();
  console.log(`Done. Success: ${success}, Failed: ${failed}, Total: ${toIngest.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
