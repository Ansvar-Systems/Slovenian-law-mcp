import type { CitationFormat } from '../types/citations.js';
import { parseCitation } from './parser.js';

const CODE_FULL_NAMES: Record<string, string> = {
  'URS': 'Ustava Republike Slovenije',
  'OZ': 'Obligacijski zakonik',
  'SPZ': 'Stvarnopravni zakonik',
  'DZ': 'Dedni zakon',
  'ZZZDR': 'Zakon o zakonski zvezi in družinskih razmerjih',
  'DZ-1': 'Družinski zakonik',
  'KZ-1': 'Kazenski zakonik',
  'ZKP': 'Zakon o kazenskem postopku',
  'ZP-1': 'Zakon o prekrških',
  'ZPP': 'Zakon o pravdnem postopku',
  'ZIZ': 'Zakon o izvršbi in zavarovanju',
  'ZUS-1': 'Zakon o upravnem sporu',
  'ZUP': 'Zakon o splošnem upravnem postopku',
  'ZGD-1': 'Zakon o gospodarskih družbah',
  'ZFPPIPP': 'Zakon o finančnem poslovanju, postopkih zaradi insolventnosti in prisilnem prenehanju',
  'ZDR-1': 'Zakon o delovnih razmerjih',
  'ZUTD': 'Zakon o urejanju trga dela',
  'ZLS': 'Zakon o lokalni samoupravi',
  'ZJU': 'Zakon o javnih uslužbencih',
  'ZDU-1': 'Zakon o državni upravi',
  'ZVOP-2': 'Zakon o varstvu osebnih podatkov',
  'ZDavP-2': 'Zakon o davčnem postopku',
  'ZDDV-1': 'Zakon o davku na dodano vrednost',
  'ZDoh-2': 'Zakon o dohodnini',
  'ZDDPO-2': 'Zakon o davku od dohodkov pravnih oseb',
  'ZVO-2': 'Zakon o varstvu okolja',
  'ZGO-1': 'Zakon o graditvi objektov',
  'ZJN-3': 'Zakon o javnem naročanju',
  'ZMed': 'Zakon o medijih',
  'ZZavar-1': 'Zakon o zavarovalništvu',
  'ZBan-3': 'Zakon o bančništvu',
  'ZTFI-1': 'Zakon o trgu finančnih instrumentov',
};

export function formatCitation(citation: string, format: CitationFormat = 'full'): string {
  const parsed = parseCitation(citation);
  if (!parsed.valid) return citation;

  if (parsed.type === 'case_law' && parsed.ecli) {
    return parsed.ecli;
  }

  if (parsed.type === 'eu_directive' || parsed.type === 'eu_regulation') {
    return parsed.raw;
  }

  // Statute formatting
  if (parsed.type === 'statute' && parsed.code_abbreviation) {
    const code = parsed.code_abbreviation;
    const article = parsed.article ?? '';
    const paragraphStr = parsed.paragraph ? `, ${parsed.paragraph}. odstavek` : '';

    switch (format) {
      case 'full': {
        const fullName = CODE_FULL_NAMES[code] || code;
        return `${article}. člen ${fullName} (${code})${paragraphStr}`;
      }
      case 'short':
        return `${article}. člen ${code}${paragraphStr}`;
      case 'pinpoint':
        return `${article}. člen${paragraphStr}`;
    }
  }

  return citation;
}
