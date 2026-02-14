const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

export function normalizeAsOfDate(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!ISO_DATE_PATTERN.test(trimmed) || !isValidCalendarDate(trimmed)) {
    throw new Error('as_of_date must be an ISO date in YYYY-MM-DD format');
  }
  return trimmed;
}

export function extractRepealDateFromDescription(description: string | null): string | undefined {
  if (!description) return undefined;
  // Slovenian: "Prenehal veljati DD.MM.YYYY" or "Razveljavljen DD.MM.YYYY"
  const match = description.match(/Prenehal\s+veljati\s+(\d{2})\.(\d{2})\.(\d{4})/i)
    || description.match(/Razveljavljen[a]?\s+(\d{2})\.(\d{2})\.(\d{4})/i)
    || description.match(/(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return undefined;

  // Check if it's already ISO format (YYYY-MM-DD)
  if (match[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
    return match[0];
  }

  // Convert DD.MM.YYYY to YYYY-MM-DD
  return `${match[3]}-${match[2]}-${match[1]}`;
}
