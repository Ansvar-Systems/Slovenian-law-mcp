import type { Database } from '@ansvar/mcp-sqlite';
import { normalizeAsOfDate } from '../utils/as-of-date.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface GetProvisionAtDateInput {
  document_id: string;
  provision_ref: string;
  date: string;
  include_amendments?: boolean;
}

export interface AmendmentRecord {
  source_document_id: string;
  amendment_date: string | null;
  ref_type: string;
}

export interface ProvisionVersion {
  provision_ref: string;
  chapter: string | null;
  section: string | null;
  article: string;
  title: string | null;
  content: string;
  valid_from: string | null;
  valid_to: string | null;
  status: 'current' | 'historical' | 'future' | 'not_found';
  amendments?: AmendmentRecord[];
}

function determineProvisionStatus(
  validFrom: string | null,
  validTo: string | null,
  queryDate: string,
): 'current' | 'historical' | 'future' | 'not_found' {
  const today = new Date().toISOString().slice(0, 10);

  if (validFrom && queryDate < validFrom) return 'future';
  if (validTo && queryDate >= validTo) return 'historical';

  const isCurrentToday = (!validFrom || validFrom <= today) && (!validTo || validTo > today);
  if (isCurrentToday) return 'current';
  if (validTo && today >= validTo) return 'historical';

  return 'current';
}

function getAmendments(
  db: Database,
  documentId: string,
  provisionRef: string,
): AmendmentRecord[] {
  const sql = `
    SELECT source_document_id, ref_type
    FROM cross_references
    WHERE target_document_id = ?
      AND target_provision_ref = ?
      AND ref_type = 'amended_by'
  `;

  const rows = db.prepare(sql).all(documentId, provisionRef) as Array<{
    source_document_id: string;
    ref_type: string;
  }>;

  return rows.map(row => ({
    source_document_id: row.source_document_id,
    amendment_date: null,
    ref_type: row.ref_type,
  }));
}

export async function getProvisionAtDate(
  db: Database,
  input: GetProvisionAtDateInput,
): Promise<ToolResponse<ProvisionVersion>> {
  const { document_id, provision_ref, include_amendments } = input;
  const queryDate = normalizeAsOfDate(input.date);

  if (!queryDate) {
    throw new Error('date parameter is required and must be in YYYY-MM-DD format');
  }

  const sql = `
    SELECT provision_ref, chapter, section, article, title, content, valid_from, valid_to
    FROM legal_provision_versions
    WHERE document_id = ? AND provision_ref = ?
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_to IS NULL OR valid_to > ?)
    ORDER BY valid_from DESC
    LIMIT 1
  `;

  const row = db.prepare(sql).get(document_id, provision_ref, queryDate, queryDate) as {
    provision_ref: string; chapter: string | null; section: string | null;
    article: string; title: string | null; content: string;
    valid_from: string | null; valid_to: string | null;
  } | undefined;

  if (!row) {
    const futureSql = `
      SELECT provision_ref, chapter, section, article, title, content, valid_from, valid_to
      FROM legal_provision_versions
      WHERE document_id = ? AND provision_ref = ? AND valid_from > ?
      ORDER BY valid_from ASC
      LIMIT 1
    `;

    const futureRow = db.prepare(futureSql).get(document_id, provision_ref, queryDate) as {
      provision_ref: string; chapter: string | null; section: string | null;
      article: string; title: string | null; content: string;
      valid_from: string | null; valid_to: string | null;
    } | undefined;

    if (futureRow) {
      return {
        results: { ...futureRow, status: 'future' as const },
        _metadata: generateResponseMetadata(db),
      };
    }

    return {
      results: {
        provision_ref, chapter: null, section: null,
        article: provision_ref, title: null, content: '',
        valid_from: null, valid_to: null, status: 'not_found',
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const status = determineProvisionStatus(row.valid_from, row.valid_to, queryDate);

  const result: ProvisionVersion = { ...row, status };

  if (include_amendments) {
    result.amendments = getAmendments(db, document_id, provision_ref);
  }

  return { results: result, _metadata: generateResponseMetadata(db) };
}
