/**
 * Document ID resolution for Slovenian Law MCP.
 *
 * Resolves fuzzy document references (titles, short names) to database document IDs.
 * 5-step cascade: direct ID -> exact title -> LIKE shortest -> case-insensitive LIKE shortest
 *   -> punctuation-normalized scan (shortest) -> null.
 */

import type { Database } from '@ansvar/mcp-sqlite';

/**
 * Strip punctuation that commonly differs between user input and stored titles.
 */
function normalizePunctuation(s: string): string {
  return s.replace(/[,;:.()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve a document identifier to a database document ID.
 * Handles direct IDs, exact title matches, and fuzzy title lookup.
 */
// ---------------------------------------------------------------------------
// Abbreviation map — add entries as needed
// ---------------------------------------------------------------------------

const ABBREVIATIONS: Record<string, string> = {
  'ZVOP-2': 'ZAKO7959',
  'zvop-2': 'ZAKO7959',
};

export function resolveDocumentId(
  db: Database,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Step 0: Abbreviation map
  const abbrev = ABBREVIATIONS[trimmed];
  if (abbrev) return abbrev;

  // Step 1: Direct ID match
  try {
    const directMatch = db.prepare(
      'SELECT id FROM legal_documents WHERE id = ?'
    ).get(trimmed) as { id: string } | undefined;
    if (directMatch) return directMatch.id;
  } catch {
    // table may not exist in test fixtures
  }

  // Step 2: Exact title match (case-insensitive)
  const trimmedLower = trimmed.toLowerCase();
  try {
    const allDocs = db.prepare(
      'SELECT id, title FROM legal_documents'
    ).all() as { id: string; title: string }[];

    const exactFull = allDocs.find(d => d.title.toLowerCase() === trimmedLower);
    if (exactFull) return exactFull.id;
  } catch {
    // ignore
  }

  // Step 3: Substring LIKE — pick shortest matching title (closest to user input)
  try {
    const likeRows = db.prepare(
      'SELECT id, title FROM legal_documents WHERE title LIKE ?'
    ).all(`%${trimmed}%`) as { id: string; title: string }[];
    if (likeRows.length > 0) {
      likeRows.sort((a, b) => a.title.length - b.title.length);
      return likeRows[0].id;
    }
  } catch {
    // ignore
  }

  // Step 4: Case-insensitive LIKE — shortest match
  try {
    const lowerRows = db.prepare(
      'SELECT id, title FROM legal_documents WHERE LOWER(title) LIKE LOWER(?)'
    ).all(`%${trimmed}%`) as { id: string; title: string }[];
    if (lowerRows.length > 0) {
      lowerRows.sort((a, b) => a.title.length - b.title.length);
      return lowerRows[0].id;
    }
  } catch {
    // ignore
  }

  // Step 5: Punctuation-normalized full scan — shortest match
  try {
    const stripped = normalizePunctuation(trimmed);
    const strippedLower = stripped.toLowerCase();
    const allDocs = db.prepare(
      'SELECT id, title FROM legal_documents'
    ).all() as { id: string; title: string }[];

    const matches: { id: string; titleLen: number }[] = [];
    for (const doc of allDocs) {
      if (normalizePunctuation(doc.title).toLowerCase().includes(strippedLower)) {
        matches.push({ id: doc.id, titleLen: doc.title.length });
      }
    }
    if (matches.length > 0) {
      matches.sort((a, b) => a.titleLen - b.titleLen);
      return matches[0].id;
    }
  } catch {
    // ignore
  }

  // Resolution failed
  return null;
}
