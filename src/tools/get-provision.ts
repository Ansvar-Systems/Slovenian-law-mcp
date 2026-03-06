import type { Database } from '@ansvar/mcp-sqlite';
import { normalizeAsOfDate } from '../utils/as-of-date.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface GetProvisionInput {
  document_id: string;
  article?: string;
  provision_ref?: string;
  as_of_date?: string;
}

export interface GetProvisionResult {
  document_id: string;
  document_title: string;
  document_status: string;
  provision_ref: string;
  chapter: string | null;
  section: string | null;
  article: string;
  title: string | null;
  content: string;
  valid_from?: string | null;
  valid_to?: string | null;
}

function buildProvisionRef(input: GetProvisionInput): string | undefined {
  if (input.provision_ref) return input.provision_ref;
  if (input.article) return input.article;
  return undefined;
}

function getCurrentProvisions(
  db: Database,
  documentId: string,
  provisionRef: string | undefined,
): GetProvisionResult[] {
  if (provisionRef) {
    const sql = `
      SELECT
        p.document_id,
        d.title AS document_title,
        d.status AS document_status,
        p.provision_ref,
        p.chapter,
        p.section,
        p.article,
        p.title,
        p.content
      FROM legal_provisions AS p
      JOIN legal_documents AS d ON p.document_id = d.id
      WHERE p.document_id = ? AND p.provision_ref = ?
    `;
    return db.prepare(sql).all(documentId, provisionRef) as GetProvisionResult[];
  }

  const sql = `
    SELECT
      p.document_id,
      d.title AS document_title,
      d.status AS document_status,
      p.provision_ref,
      p.chapter,
      p.section,
      p.article,
      p.title,
      p.content
    FROM legal_provisions AS p
    JOIN legal_documents AS d ON p.document_id = d.id
    WHERE p.document_id = ?
    ORDER BY p.id
    LIMIT 200
  `;
  return db.prepare(sql).all(documentId) as GetProvisionResult[];
}

function getVersionedProvisions(
  db: Database,
  documentId: string,
  provisionRef: string | undefined,
  asOfDate: string,
): GetProvisionResult[] {
  const conditions: string[] = [
    'pv.document_id = ?',
    '(pv.valid_from IS NULL OR pv.valid_from <= ?)',
    '(pv.valid_to IS NULL OR pv.valid_to > ?)',
  ];
  const params: string[] = [documentId, asOfDate, asOfDate];

  if (provisionRef) {
    conditions.push('pv.provision_ref = ?');
    params.push(provisionRef);
  }

  const sql = `
    SELECT
      pv.document_id,
      d.title AS document_title,
      d.status AS document_status,
      pv.provision_ref,
      pv.chapter,
      pv.section,
      pv.article,
      pv.title,
      pv.content,
      pv.valid_from,
      pv.valid_to
    FROM legal_provision_versions AS pv
    JOIN legal_documents AS d ON pv.document_id = d.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY pv.id
  `;
  return db.prepare(sql).all(...params) as GetProvisionResult[];
}

export async function getProvision(
  db: Database,
  input: GetProvisionInput,
): Promise<ToolResponse<GetProvisionResult[]>> {
  const { document_id } = input;
  const asOfDate = normalizeAsOfDate(input.as_of_date);
  const provisionRef = buildProvisionRef(input);

  const results = asOfDate
    ? getVersionedProvisions(db, document_id, provisionRef, asOfDate)
    : getCurrentProvisions(db, document_id, provisionRef);

  const metadata = generateResponseMetadata(db);
  if (!provisionRef && results.length >= 200) {
    return {
      results,
      _metadata: {
        ...metadata,
        warning: 'Results truncated at 200 provisions. Specify an article or provision_ref to retrieve a specific provision.',
      },
    };
  }

  return { results, _metadata: metadata };
}
