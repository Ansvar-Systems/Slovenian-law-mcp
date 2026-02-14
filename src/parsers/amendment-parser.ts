/**
 * Parser for Slovenian legal amendment references
 *
 * Extracts amendment information from Slovenian legal provision text, including:
 * - Uradni list references (official gazette references)
 * - Amendment types (spremenjen, razveljavljen, črtan, dodan)
 * - PIS-ID references
 * - Effective dates
 */

export interface AmendmentReference {
  /** Uradni list reference if found, e.g. "RS, št. 63/13" */
  uradni_list_ref?: string;
  /** PIS-ID of amending statute if found */
  amended_by_pis?: string;
  /** Type of amendment */
  amendment_type: 'spremenjen' | 'razveljavljen' | 'črtan' | 'dodan' | 'nov';
  /** Position in text where reference was found */
  position: 'suffix' | 'inline' | 'header';
  /** Raw text fragment containing the reference */
  raw_text: string;
}

export interface ProvisionAmendment {
  provision_ref: string;
  amendments: AmendmentReference[];
}

/**
 * Slovenian month names for date extraction
 */
const SLOVENIAN_MONTHS = [
  'januar', 'februar', 'marec', 'april', 'maj', 'junij',
  'julij', 'avgust', 'september', 'oktober', 'november', 'december',
];

/**
 * Patterns for detecting amendments in Slovenian legal text
 */
const AMENDMENT_PATTERNS = {
  // "Spremenjen z zakonom, Ur. l. RS, št. 63/13"
  spremenjen: /(?:Spremenjen|spremenjen)\s+z\s+(?:zakonom|uredbo|odlokom)\s*,?\s*(?:Ur\.?\s*l\.?\s*RS,?\s*št\.?\s*(\d+\/\d+(?:-\w+)?))/gi,

  // "Razveljavljen z odločbo US, Ur. l. RS, št. 63/13"
  razveljavljen: /(?:Razveljavljen|razveljavljen)\s+(?:z\s+(?:odločbo|zakonom|uredbo)\s*,?\s*)?(?:Ur\.?\s*l\.?\s*RS,?\s*št\.?\s*(\d+\/\d+(?:-\w+)?))/gi,

  // "Črtan z zakonom, Ur. l. RS, št. 63/13"
  crtan: /(?:Črtan|črtan)\s+z\s+(?:zakonom|uredbo)\s*,?\s*(?:Ur\.?\s*l\.?\s*RS,?\s*št\.?\s*(\d+\/\d+(?:-\w+)?))/gi,

  // "Dodan z zakonom, Ur. l. RS, št. 63/13"
  dodan: /(?:Dodan|dodan)\s+z\s+(?:zakonom|uredbo|odlokom)\s*,?\s*(?:Ur\.?\s*l\.?\s*RS,?\s*št\.?\s*(\d+\/\d+(?:-\w+)?))/gi,

  // Generic "Ur. l. RS, št. NN/YY" reference
  uradni_list: /Ur(?:adni\s+list|\.?\s*l\.?)\s*RS,?\s*(?:št\.?\s*)?(\d+\/\d+(?:-\w+)?)/gi,

  // "Prenehal veljati DD.MM.YYYY" or "Prenehal veljati DD. MM. YYYY"
  prenehal: /(?:Prenehal|prenehal)\s+veljati\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/gi,
};

/**
 * Extract all amendment references from a text
 */
export function extractAmendmentReferences(content: string): AmendmentReference[] {
  const amendments: AmendmentReference[] = [];
  const processedRefs = new Set<string>();

  let match: RegExpExecArray | null;

  // Check for "spremenjen" amendments
  AMENDMENT_PATTERNS.spremenjen.lastIndex = 0;
  while ((match = AMENDMENT_PATTERNS.spremenjen.exec(content)) !== null) {
    const uradni_list_ref = match[1] ? `RS, št. ${match[1]}` : undefined;
    const key = `spremenjen-${uradni_list_ref ?? match[0]}`;

    if (!processedRefs.has(key)) {
      processedRefs.add(key);
      amendments.push({
        uradni_list_ref,
        amendment_type: 'spremenjen',
        position: determinePosition(content, match.index),
        raw_text: match[0],
      });
    }
  }

  // Check for "razveljavljen" repeals
  AMENDMENT_PATTERNS.razveljavljen.lastIndex = 0;
  while ((match = AMENDMENT_PATTERNS.razveljavljen.exec(content)) !== null) {
    const uradni_list_ref = match[1] ? `RS, št. ${match[1]}` : undefined;
    const key = `razveljavljen-${uradni_list_ref ?? match[0]}`;

    if (!processedRefs.has(key)) {
      processedRefs.add(key);
      amendments.push({
        uradni_list_ref,
        amendment_type: 'razveljavljen',
        position: determinePosition(content, match.index),
        raw_text: match[0],
      });
    }
  }

  // Check for "črtan" deletions
  AMENDMENT_PATTERNS.crtan.lastIndex = 0;
  while ((match = AMENDMENT_PATTERNS.crtan.exec(content)) !== null) {
    const uradni_list_ref = match[1] ? `RS, št. ${match[1]}` : undefined;
    const key = `črtan-${uradni_list_ref ?? match[0]}`;

    if (!processedRefs.has(key)) {
      processedRefs.add(key);
      amendments.push({
        uradni_list_ref,
        amendment_type: 'črtan',
        position: determinePosition(content, match.index),
        raw_text: match[0],
      });
    }
  }

  // Check for "dodan" insertions
  AMENDMENT_PATTERNS.dodan.lastIndex = 0;
  while ((match = AMENDMENT_PATTERNS.dodan.exec(content)) !== null) {
    const uradni_list_ref = match[1] ? `RS, št. ${match[1]}` : undefined;
    const key = `dodan-${uradni_list_ref ?? match[0]}`;

    if (!processedRefs.has(key)) {
      processedRefs.add(key);
      amendments.push({
        uradni_list_ref,
        amendment_type: 'dodan',
        position: determinePosition(content, match.index),
        raw_text: match[0],
      });
    }
  }

  return amendments;
}

/**
 * Parse amendments for multiple provisions
 */
export function parseStatuteAmendments(
  provisions: Array<{ provision_ref: string; content: string }>,
): ProvisionAmendment[] {
  return provisions.map(prov => ({
    provision_ref: prov.provision_ref,
    amendments: extractAmendmentReferences(prov.content),
  }));
}

/**
 * Validate an Uradni list reference format
 */
export function isValidUradniListRef(ref: string): boolean {
  // Should be in format "NN/YY" or "NN/YY-ZZ"
  const pattern = /^\d+\/\d+(-\w+)?$/;
  return pattern.test(ref);
}

/**
 * Normalize an Uradni list reference to standard format "RS, št. NN/YY"
 */
export function normalizeUradniListRef(ref: string): string | null {
  const match = ref.match(/(\d+\/\d+(?:-\w+)?)/);
  if (!match) {
    return null;
  }
  return `RS, št. ${match[1]}`;
}

/**
 * Extract effective date from Slovenian text
 * Returns date in ISO format (YYYY-MM-DD) if found
 */
export function extractEffectiveDate(text: string): string | null {
  // Pattern: "DD. mesec YYYY" or "DD.MM.YYYY"
  const numericPattern = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/;
  const numMatch = text.match(numericPattern);

  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const month = numMatch[2].padStart(2, '0');
    const year = numMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Pattern: "DD. mesec YYYY"
  const wordPattern = /(\d{1,2})\.\s*(januar(?:ja)?|februar(?:ja)?|marc(?:a|ec)|april(?:a)?|maj(?:a)?|junij(?:a)?|julij(?:a)?|august(?:a)?|september|septembr(?:a)?|oktober|oktobr(?:a)?|november|novembr(?:a)?|december|decembr(?:a)?)\s+(\d{4})/i;
  const wordMatch = text.match(wordPattern);

  if (!wordMatch) {
    return null;
  }

  const day = wordMatch[1].padStart(2, '0');
  const monthName = wordMatch[2].toLowerCase();
  const year = wordMatch[3];

  // Find month index by checking prefix
  let monthIndex = -1;
  for (let i = 0; i < SLOVENIAN_MONTHS.length; i++) {
    if (monthName.startsWith(SLOVENIAN_MONTHS[i].slice(0, 3))) {
      monthIndex = i;
      break;
    }
  }

  if (monthIndex === -1) {
    return null;
  }

  const month = (monthIndex + 1).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Determine position of amendment reference in text
 */
function determinePosition(content: string, index: number): 'suffix' | 'inline' | 'header' {
  const lines = content.substring(0, index).split('\n');
  const currentLine = lines[lines.length - 1];

  if (index < 100) {
    return 'header';
  }

  if (currentLine.trim().length < 10) {
    return 'suffix';
  }

  return 'inline';
}
