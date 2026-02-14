import type { Database } from '@ansvar/mcp-sqlite';
import { normalizeAsOfDate, extractRepealDateFromDescription } from '../utils/as-of-date.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface CheckCurrencyInput {
  document_id: string;
  provision_ref?: string;
  as_of_date?: string;
}

export interface CheckCurrencyResult {
  document_id: string;
  document_title: string;
  status: string;
  is_current: boolean;
  as_of_date: string;
  in_force_date: string | null;
  repeal_date: string | null;
  provision_ref: string | null;
  provision_valid_from: string | null;
  provision_valid_to: string | null;
  warnings: string[];
  related_case_law: RelatedCaseLaw[];
}

interface RelatedCaseLaw {
  ecli: string;
  court: string;
  decision_date: string | null;
  summary: string | null;
  url: string | null;
}

export async function checkCurrency(
  db: Database,
  input: CheckCurrencyInput,
): Promise<ToolResponse<CheckCurrencyResult>> {
  const { document_id, provision_ref } = input;
  const asOfDate = normalizeAsOfDate(input.as_of_date) ?? new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];

  const docRow = db.prepare(
    'SELECT id, title, status, in_force_date, description FROM legal_documents WHERE id = ?'
  ).get(document_id) as {
    id: string;
    title: string;
    status: string;
    in_force_date: string | null;
    description: string | null;
  } | undefined;

  if (!docRow) {
    return {
      results: {
        document_id,
        document_title: '',
        status: 'not_found',
        is_current: false,
        as_of_date: asOfDate,
        in_force_date: null,
        repeal_date: null,
        provision_ref: provision_ref ?? null,
        provision_valid_from: null,
        provision_valid_to: null,
        warnings: [`Dokument ${document_id} ni najden v bazi podatkov`],
        related_case_law: [],
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const repealDate = extractRepealDateFromDescription(docRow.description) ?? null;

  let isCurrent = docRow.status === 'in_force' || docRow.status === 'amended';

  if (docRow.status === 'repealed') {
    warnings.push(`"${docRow.title}" je prenehal veljati (repealed)`);
    isCurrent = false;
  }

  if (docRow.status === 'not_yet_in_force') {
    warnings.push(`"${docRow.title}" še ni začel veljati (not yet in force)`);
    isCurrent = false;
  }

  if (docRow.in_force_date && asOfDate < docRow.in_force_date) {
    warnings.push(`Datum ${asOfDate} je pred datumom začetka veljavnosti ${docRow.in_force_date}`);
    isCurrent = false;
  }

  if (repealDate && asOfDate >= repealDate) {
    warnings.push(`Datum ${asOfDate} je po datumu prenehanja veljavnosti ${repealDate}`);
    isCurrent = false;
  }

  let provisionValidFrom: string | null = null;
  let provisionValidTo: string | null = null;

  if (provision_ref) {
    const verRow = db.prepare(
      `SELECT valid_from, valid_to
       FROM legal_provision_versions
       WHERE document_id = ? AND provision_ref = ?
         AND (valid_from IS NULL OR valid_from <= ?)
         AND (valid_to IS NULL OR valid_to > ?)
       ORDER BY valid_from DESC
       LIMIT 1`
    ).get(document_id, provision_ref, asOfDate, asOfDate) as {
      valid_from: string | null;
      valid_to: string | null;
    } | undefined;

    if (verRow) {
      provisionValidFrom = verRow.valid_from;
      provisionValidTo = verRow.valid_to;
    } else {
      const anyVersion = db.prepare(
        'SELECT COUNT(*) AS c FROM legal_provision_versions WHERE document_id = ? AND provision_ref = ?'
      ).get(document_id, provision_ref) as { c: number };

      if (anyVersion.c > 0) {
        warnings.push(`Člen ${provision_ref} nima veljavne različice na datum ${asOfDate}`);
        isCurrent = false;
      } else {
        const currentProv = db.prepare(
          'SELECT id FROM legal_provisions WHERE document_id = ? AND provision_ref = ?'
        ).get(document_id, provision_ref);
        if (!currentProv) {
          warnings.push(`Člen ${provision_ref} ni najden v dokumentu ${document_id}`);
        }
      }
    }
  }

  const relatedCaseLaw: RelatedCaseLaw[] = [];
  try {
    const caseLawSql = `
      SELECT
        cl.ecli,
        cl.court,
        cl.decision_date,
        cl.summary,
        d.url
      FROM cross_references AS xr
      JOIN case_law AS cl ON xr.source_document_id = cl.document_id
      JOIN legal_documents AS d ON cl.document_id = d.id
      WHERE xr.target_document_id = ?
        ${provision_ref ? 'AND xr.target_provision_ref = ?' : ''}
      ORDER BY cl.decision_date DESC
      LIMIT 5
    `;
    const caseLawParams = provision_ref
      ? [document_id, provision_ref]
      : [document_id];
    const rows = db.prepare(caseLawSql).all(...caseLawParams) as RelatedCaseLaw[];
    relatedCaseLaw.push(...rows);
  } catch {
    // Non-fatal
  }

  return {
    results: {
      document_id: docRow.id,
      document_title: docRow.title,
      status: docRow.status,
      is_current: isCurrent,
      as_of_date: asOfDate,
      in_force_date: docRow.in_force_date,
      repeal_date: repealDate,
      provision_ref: provision_ref ?? null,
      provision_valid_from: provisionValidFrom,
      provision_valid_to: provisionValidTo,
      warnings,
      related_case_law: relatedCaseLaw,
    },
    _metadata: generateResponseMetadata(db),
  };
}
