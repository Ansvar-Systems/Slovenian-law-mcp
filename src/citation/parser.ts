import type { ParsedCitation } from '../types/citations.js';

/**
 * Map Slovenian statute abbreviations to PIS document IDs.
 *
 * These are the most commonly cited Slovenian laws. The ID format
 * follows the PIS naming convention (e.g., "zakon-o-kazenskem-postopku").
 */
const CODE_TO_PIS: Record<string, string> = {
  // Constitutional
  'URS': 'ustava-rs',

  // Civil / obligations
  'OZ': 'obligacijski-zakonik',
  'SPZ': 'stvarnopravni-zakonik',
  'DZ': 'dedni-zakon',
  'ZZZDR': 'zakon-o-zakonski-zvezi-in-druzinskih-razmerjih',
  'DZ-1': 'druzinski-zakonik',

  // Criminal
  'KZ-1': 'kazenski-zakonik',
  'ZKP': 'zakon-o-kazenskem-postopku',
  'ZP-1': 'zakon-o-prekrskih',

  // Procedural
  'ZPP': 'zakon-o-pravdnem-postopku',
  'ZIZ': 'zakon-o-izvrsbi-in-zavarovanju',
  'ZUS-1': 'zakon-o-upravnem-sporu',
  'ZUP': 'zakon-o-splosnem-upravnem-postopku',

  // Commercial / corporate
  'ZGD-1': 'zakon-o-gospodarskih-druzbah',
  'ZFPPIPP': 'zakon-o-financnem-poslovanju-postopkih-zaradi-insolventnosti-in-prisilnem-prenehanju',

  // Labour
  'ZDR-1': 'zakon-o-delovnih-razmerjih',
  'ZUTD': 'zakon-o-urejanju-trga-dela',

  // Administrative
  'ZLS': 'zakon-o-lokalni-samoupravi',
  'ZJU': 'zakon-o-javnih-usluzbenskih',
  'ZDU-1': 'zakon-o-drzavni-upravi',

  // Data protection / GDPR
  'ZVOP-2': 'zakon-o-varstvu-osebnih-podatkov',

  // Tax
  'ZDavP-2': 'zakon-o-davcnem-postopku',
  'ZDDV-1': 'zakon-o-davku-na-dodano-vrednost',
  'ZDoh-2': 'zakon-o-dohodnini',
  'ZDDPO-2': 'zakon-o-davku-od-dohodkov-pravnih-oseb',

  // Environmental
  'ZVO-2': 'zakon-o-varstvu-okolja',
  'ZGO-1': 'zakon-o-graditvi-objektov',

  // Other key statutes
  'ZJN-3': 'zakon-o-javnem-narocanju',
  'ZMed': 'zakon-o-medijih',
  'ZZavar-1': 'zakon-o-zavarovalnistvu',
  'ZBan-3': 'zakon-o-bancnistvu',
  'ZTFI-1': 'zakon-o-trgu-financnih-instrumentov',
};

// ECLI pattern for Slovenian courts: ECLI:SI:...
const ECLI_PATTERN = /^ECLI:SI:[A-Z]{2,5}:\d{4}:[\w.]+$/;

// Uradni list reference: "Uradni list RS, št. 63/13" or "Ur. l. RS, št. 63/13"
const URADNI_LIST_PATTERN = /^(?:Uradni\s+list|Ur\.\s*l\.)\s+RS,?\s+[šs]t\.\s+(\d+\/\d{2}(?:-\d+)?)/i;

// EU directive: "Direktiva (EU) 2019/770" or "Direktiva 95/46/ES"
const EU_DIRECTIVE_PATTERN = /^[Dd]irektiva\s+(?:\(?(EU|ES|EGS)\)?\s+)?(?:št\.\s*)?(\d{2,4})\/(\d+)(?:\/(EU|ES|EGS))?/;

// EU regulation: "Uredba (EU) 2016/679"
const EU_REGULATION_PATTERN = /^[Uu]redba\s+(?:\(?(EU|ES|EGS)\)?\s+)?(?:št\.\s*)?(\d{2,4})\/(\d+)/;

// Slovenian statute pattern: "1. člen ZKP" or "čl. 287 OZ" or "1. odstavek 6. člena KZ-1"
const CODE_NAMES = Object.keys(CODE_TO_PIS).join('|');
const STATUTE_PATTERN = new RegExp(
  `^(?:(\\d+)\\.\\s*(?:odstavek|odst\\.)\\s+)?(\\d+[a-ž]?)\\.?\\s*(?:člen[a]?|čl\\.?)\\s+(${CODE_NAMES})$`,
  'i',
);

// Alternative pattern: "ZKP, 1. člen" or "OZ 6. člen"
const ALT_STATUTE_PATTERN = new RegExp(
  `^(${CODE_NAMES}),?\\s+(\\d+[a-ž]?)\\.?\\s*(?:člen[a]?|čl\\.?)(?:\\s+(\\d+)\\.\\s*(?:odstavek|odst\\.))?$`,
  'i',
);


export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();
  if (!trimmed) {
    return { raw: citation, type: 'statute', document_id: '', valid: false, error: 'Empty citation' };
  }

  // 1. Try ECLI
  if (ECLI_PATTERN.test(trimmed)) {
    return {
      raw: citation,
      type: 'case_law',
      document_id: trimmed,
      ecli: trimmed,
      valid: true,
    };
  }

  // 2. Try Uradni list reference
  const ulMatch = trimmed.match(URADNI_LIST_PATTERN);
  if (ulMatch) {
    return {
      raw: citation,
      type: 'statute',
      document_id: `UL-${ulMatch[1]}`,
      uradni_list_ref: ulMatch[1],
      valid: true,
    };
  }

  // 3. Try EU directive
  const dirMatch = trimmed.match(EU_DIRECTIVE_PATTERN);
  if (dirMatch) {
    const year = parseInt(dirMatch[2], 10);
    const number = parseInt(dirMatch[3], 10);
    return {
      raw: citation,
      type: 'eu_directive',
      document_id: `directive:${year}/${number}`,
      valid: true,
    };
  }

  // 4. Try EU regulation
  const regMatch = trimmed.match(EU_REGULATION_PATTERN);
  if (regMatch) {
    const year = parseInt(regMatch[2], 10);
    const number = parseInt(regMatch[3], 10);
    return {
      raw: citation,
      type: 'eu_regulation',
      document_id: `regulation:${year}/${number}`,
      valid: true,
    };
  }

  // 5. Try statute pattern: "1. člen ZKP"
  const statMatch = trimmed.match(STATUTE_PATTERN);
  if (statMatch) {
    const paragraph = statMatch[1] || undefined;
    const article = statMatch[2];
    const code = statMatch[3];
    const pisId = CODE_TO_PIS[code] || code.toLowerCase();

    return {
      raw: citation,
      type: 'statute',
      document_id: pisId,
      article,
      paragraph,
      code_abbreviation: code,
      valid: true,
    };
  }

  // 6. Try alternative pattern: "ZKP, 1. člen"
  const altMatch = trimmed.match(ALT_STATUTE_PATTERN);
  if (altMatch) {
    const code = altMatch[1];
    const article = altMatch[2];
    const paragraph = altMatch[3] || undefined;
    const pisId = CODE_TO_PIS[code] || code.toLowerCase();

    return {
      raw: citation,
      type: 'statute',
      document_id: pisId,
      article,
      paragraph,
      code_abbreviation: code,
      valid: true,
    };
  }

  return {
    raw: citation,
    type: 'statute',
    document_id: '',
    valid: false,
    error: `Unrecognized citation format: "${trimmed}"`,
  };
}
