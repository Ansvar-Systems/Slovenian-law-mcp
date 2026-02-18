import type { Database } from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';
import { searchLegislation, type SearchLegislationResult } from './search-legislation.js';
import { searchCaseLaw, type SearchCaseLawResult } from './search-case-law.js';

export interface BuildLegalStanceInput {
  query: string;
  document_id?: string;
  as_of_date?: string;
  limit?: number;
}

export interface BuildLegalStanceResult {
  query: string;
  provisions: SearchLegislationResult[];
  case_law: SearchCaseLawResult[];
  preparatory_works: PreparatoryWorkSummary[];
  cross_references: CrossReferenceSummary[];
}

interface PreparatoryWorkSummary {
  statute_id: string;
  prep_document_id: string;
  parliamentary_ref: string | null;
  document_type: string | null;
  title: string | null;
  summary: string | null;
}

interface CrossReferenceSummary {
  source_document_id: string;
  source_provision_ref: string | null;
  target_document_id: string;
  target_provision_ref: string | null;
  ref_type: string;
}

const DEFAULT_LIMIT = 5;

export async function buildLegalStance(
  db: Database,
  input: BuildLegalStanceInput,
): Promise<ToolResponse<BuildLegalStanceResult>> {
  const { query, document_id, as_of_date } = input;
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, 20);

  const provisionResults = await searchLegislation(db, {
    query,
    document_id,
    as_of_date,
    limit,
  });

  const caseLawResults = await searchCaseLaw(db, {
    query,
    limit,
  });

  const statuteIds = [...new Set(provisionResults.results.map(p => p.document_id))];

  const preparatoryWorks: PreparatoryWorkSummary[] = [];
  if (statuteIds.length > 0) {
    const placeholders = statuteIds.map(() => '?').join(',');
    const prepSql = `
      SELECT
        pw.statute_id,
        pw.prep_document_id,
        pw.parliamentary_ref,
        pw.document_type,
        pw.title,
        pw.summary
      FROM preparatory_works AS pw
      WHERE pw.statute_id IN (${placeholders})
      ORDER BY pw.id
    `;
    const prepRows = db.prepare(prepSql).all(...statuteIds) as PreparatoryWorkSummary[];
    preparatoryWorks.push(...prepRows);
  }

  const caseLawDocIds = caseLawResults.results.map(c => c.document_id);
  const allDocIds = [...new Set([...statuteIds, ...caseLawDocIds])];

  const crossReferences: CrossReferenceSummary[] = [];
  if (allDocIds.length > 0) {
    const placeholders = allDocIds.map(() => '?').join(',');
    const xrefSql = `
      SELECT
        source_document_id,
        source_provision_ref,
        target_document_id,
        target_provision_ref,
        ref_type
      FROM cross_references
      WHERE source_document_id IN (${placeholders})
         OR target_document_id IN (${placeholders})
      ORDER BY id
    `;
    const xrefRows = db.prepare(xrefSql).all(...allDocIds, ...allDocIds) as CrossReferenceSummary[];
    crossReferences.push(...xrefRows);
  }

  const result: BuildLegalStanceResult = {
    query,
    provisions: provisionResults.results,
    case_law: caseLawResults.results,
    preparatory_works: preparatoryWorks,
    cross_references: crossReferences,
  };

  return { results: result, _metadata: generateResponseMetadata(db) };
}
