/**
 * Extracts cross-references between Slovenian legal provisions.
 *
 * Detects patterns like:
 * - "1. člen ZKP"
 * - "v skladu z 42. členom"
 * - "na podlagi 15. do 20. člena"
 * - "3. odstavek 7. člena"
 */

export interface ExtractedCrossReference {
  /** Target statute abbreviation (e.g. "ZKP", "OZ") */
  target_statute?: string;
  /** Target article number */
  target_article?: string;
  /** Target paragraph number */
  target_paragraph?: string;
  /** Raw text fragment */
  raw_text: string;
}

// Map of common Slovenian statute abbreviations to PIS IDs
const STATUTE_ABBREVIATIONS: Record<string, string> = {
  'ZKP': 'zakon-o-kazenskem-postopku',
  'KZ-1': 'kazenski-zakonik',
  'OZ': 'obligacijski-zakonik',
  'ZPP': 'zakon-o-pravdnem-postopku',
  'ZUP': 'zakon-o-splosnem-upravnem-postopku',
  'ZDR-1': 'zakon-o-delovnih-razmerjih',
  'ZPIZ-2': 'zakon-o-pokojninskem-in-invalidskem-zavarovanju',
  'ZGD-1': 'zakon-o-gospodarskih-druzbah',
  'ZLS': 'zakon-o-lokalni-samoupravi',
  'ZJN-3': 'zakon-o-javnem-narocanju',
  'ZVOP-2': 'zakon-o-varstvu-osebnih-podatkov',
  'ZUS-1': 'zakon-o-upravnem-sporu',
  'ZDavP-2': 'zakon-o-davcnem-postopku',
  'ZDDV-1': 'zakon-o-davku-na-dodano-vrednost',
  'SPZ': 'stvarnopravni-zakonik',
  'ZZK-1': 'zakon-o-zemljiski-knjigi',
  'Ustava': 'ustava-republike-slovenije',
};

// "NN. člen(a) ABBREVIATION"
const ARTICLE_WITH_STATUTE = /(\d+)\.\s*člen(?:a|om|u)?\s+([A-ZČŠŽ][A-ZČŠŽ0-9-]+(?:-\d+)?)/g;

// "NN. člen(a)" without statute (refers to current document)
const ARTICLE_ONLY = /(\d+)\.\s*člen(?:a|om|u)?(?!\s+[A-ZČŠŽ])/g;

// "N. odstavek NN. člena"
const PARAGRAPH_ARTICLE = /(\d+)\.\s*odstavek\s+(\d+)\.\s*člen(?:a|om|u)?/g;

/**
 * Extract cross-references from Slovenian legal text
 */
export function extractCrossReferences(text: string): ExtractedCrossReference[] {
  const results: ExtractedCrossReference[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  // Paragraph + article references
  PARAGRAPH_ARTICLE.lastIndex = 0;
  while ((match = PARAGRAPH_ARTICLE.exec(text)) !== null) {
    const key = `p${match[1]}-a${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        target_article: match[2],
        target_paragraph: match[1],
        raw_text: match[0],
      });
    }
  }

  // Article with statute abbreviation
  ARTICLE_WITH_STATUTE.lastIndex = 0;
  while ((match = ARTICLE_WITH_STATUTE.exec(text)) !== null) {
    const key = `${match[2]}-a${match[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        target_statute: match[2],
        target_article: match[1],
        raw_text: match[0],
      });
    }
  }

  // Standalone article references
  ARTICLE_ONLY.lastIndex = 0;
  while ((match = ARTICLE_ONLY.exec(text)) !== null) {
    const key = `self-a${match[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        target_article: match[1],
        raw_text: match[0],
      });
    }
  }

  return results;
}

/**
 * Resolve a statute abbreviation to its PIS ID
 */
export function resolveStatuteAbbreviation(abbreviation: string): string | undefined {
  return STATUTE_ABBREVIATIONS[abbreviation];
}
