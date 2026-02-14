export interface ExtractedEUReference {
  type: 'directive' | 'regulation';
  year: number;
  number: number;
  community?: string;
  article?: string;
  reference_type: 'implements' | 'supplements' | 'applies' | 'references';
  raw_match: string;
}

/**
 * Slovenian patterns for EU legal references:
 *
 * - Direktiva (EU) 2019/770          -> directive
 * - Uredba (EU) 2016/679             -> regulation
 * - Direktiva 95/46/ES               -> directive (old ES-style)
 * - člen 6(1)(c) Uredbe              -> with article reference
 */

// Pattern for modern-style references: "Direktiva (EU) 2019/770" or "Uredba (EU) 2016/679"
const MODERN_PATTERN = /(?:člen(?:a)?\s+([\w.()]+)\s+)?(?:(Direktiv[aeo]|Uredb[aeo])\s+\((\w+)\)\s+(?:(?:št|br)\.\s+)?(\d{4})\/(\d+))/gi;

// Pattern for old-style references: "Direktiva 95/46/ES" or "Uredba 2016/679/EU"
const OLD_STYLE_PATTERN = /(?:člen(?:a)?\s+([\w.()]+)\s+)?(?:(Direktiv[aeo]|Uredb[aeo])\s+(\d{2,4})\/(\d+)\/(\w+))/gi;

// Classification keywords (searched in preceding context) — Slovenian
const IMPLEMENTS_KEYWORDS = ['za izvajanje', 'za prenos', 'prenaša'];
const SUPPLEMENTS_KEYWORDS = ['dopolnjuje', 'za dopolnitev'];
const APPLIES_KEYWORDS = ['na podlagi', 'v skladu z'];

function classifyReferenceType(
  precedingText: string,
): 'implements' | 'supplements' | 'applies' | 'references' {
  const lower = precedingText.toLowerCase();

  for (const kw of IMPLEMENTS_KEYWORDS) {
    if (lower.includes(kw)) return 'implements';
  }
  for (const kw of SUPPLEMENTS_KEYWORDS) {
    if (lower.includes(kw)) return 'supplements';
  }
  for (const kw of APPLIES_KEYWORDS) {
    if (lower.includes(kw)) return 'applies';
  }
  return 'references';
}

function normalizeYear(yearStr: string): number {
  const year = parseInt(yearStr, 10);
  if (year < 100) {
    return year >= 50 ? 1900 + year : 2000 + year;
  }
  return year;
}

function typeFromSlovenian(word: string): 'directive' | 'regulation' {
  return word.toLowerCase().startsWith('direktiv') ? 'directive' : 'regulation';
}

/**
 * Extract EU references from Slovenian statute text.
 */
export function extractEUReferences(text: string): ExtractedEUReference[] {
  const results: ExtractedEUReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  // Modern-style: "Direktiva (EU) 2019/770" or "Uredba (EU) 2016/679"
  MODERN_PATTERN.lastIndex = 0;
  while ((match = MODERN_PATTERN.exec(text)) !== null) {
    const article = match[1] || undefined;
    const docType = typeFromSlovenian(match[2]);
    const community = match[3];
    const year = normalizeYear(match[4]);
    const number = parseInt(match[5], 10);

    const precedingStart = Math.max(0, match.index - 50);
    const precedingText = text.slice(precedingStart, match.index);
    const reference_type = classifyReferenceType(precedingText);

    const key = `${docType}:${year}/${number}:${article ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: docType,
        year,
        number,
        community,
        article,
        reference_type,
        raw_match: match[0],
      });
    }
  }

  // Old-style: "Direktiva 95/46/ES"
  OLD_STYLE_PATTERN.lastIndex = 0;
  while ((match = OLD_STYLE_PATTERN.exec(text)) !== null) {
    const article = match[1] || undefined;
    const docType = typeFromSlovenian(match[2]);
    const year = normalizeYear(match[3]);
    const number = parseInt(match[4], 10);
    const community = match[5];

    const precedingStart = Math.max(0, match.index - 50);
    const precedingText = text.slice(precedingStart, match.index);
    const reference_type = classifyReferenceType(precedingText);

    const key = `${docType}:${year}/${number}:${article ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: docType,
        year,
        number,
        community,
        article,
        reference_type,
        raw_match: match[0],
      });
    }
  }

  return results;
}
