import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface SearchEUImplementationsInput {
  query?: string;
  type?: 'directive' | 'regulation';
  year_from?: number;
  year_to?: number;
  community?: 'EU' | 'EG' | 'EEG' | 'Euratom';
  has_slovenian_implementation?: boolean;
  limit?: number;
}

export interface EUDocumentSearchResult {
  id: string;
  type: string;
  year: number;
  number: number;
  community: string | null;
  celex_number: string | null;
  title: string | null;
  title_sl: string | null;
  short_name: string | null;
  in_force: boolean;
  url_eur_lex: string | null;
  slovenian_statute_count: number;
  has_slovenian_implementation: boolean;
}

export interface SearchEUImplementationsResult {
  documents: EUDocumentSearchResult[];
  total_count: number;
}

interface SearchRow {
  id: string;
  type: string;
  year: number;
  number: number;
  community: string | null;
  celex_number: string | null;
  title: string | null;
  title_sl: string | null;
  short_name: string | null;
  in_force: number;
  url_eur_lex: string | null;
  slovenian_statute_count: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function clampLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(limit, MAX_LIMIT));
}

export async function searchEUImplementations(
  db: Database,
  input: SearchEUImplementationsInput,
): Promise<ToolResponse<SearchEUImplementationsResult>> {
  const { query, type, year_from, year_to, community, has_slovenian_implementation } = input;
  const limit = clampLimit(input.limit);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query) {
    conditions.push('(ed.title_sl LIKE ? OR ed.title LIKE ? OR ed.short_name LIKE ?)');
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }

  if (type) {
    conditions.push('ed.type = ?');
    params.push(type);
  }

  if (year_from != null) {
    conditions.push('ed.year >= ?');
    params.push(year_from);
  }

  if (year_to != null) {
    conditions.push('ed.year <= ?');
    params.push(year_to);
  }

  if (community) {
    conditions.push('ed.community = ?');
    params.push(community);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const havingClause = has_slovenian_implementation === true
    ? 'HAVING slovenian_statute_count > 0'
    : has_slovenian_implementation === false
      ? 'HAVING slovenian_statute_count = 0'
      : '';

  const sql = `
    SELECT
      ed.id,
      ed.type,
      ed.year,
      ed.number,
      ed.community,
      ed.celex_number,
      ed.title,
      ed.title_sl,
      ed.short_name,
      ed.in_force,
      ed.url_eur_lex,
      COUNT(DISTINCT er.document_id) AS slovenian_statute_count
    FROM eu_documents AS ed
    LEFT JOIN eu_references AS er ON ed.id = er.eu_document_id
    ${whereClause}
    GROUP BY ed.id
    ${havingClause}
    ORDER BY ed.year DESC, ed.number ASC
    LIMIT ?
  `;
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as SearchRow[];

  const documents: EUDocumentSearchResult[] = rows.map(row => ({
    id: row.id,
    type: row.type,
    year: row.year,
    number: row.number,
    community: row.community,
    celex_number: row.celex_number,
    title: row.title,
    title_sl: row.title_sl,
    short_name: row.short_name,
    in_force: row.in_force === 1,
    url_eur_lex: row.url_eur_lex,
    slovenian_statute_count: row.slovenian_statute_count,
    has_slovenian_implementation: row.slovenian_statute_count > 0,
  }));

  return {
    results: { documents, total_count: documents.length },
    _metadata: generateResponseMetadata(db),
  };
}
