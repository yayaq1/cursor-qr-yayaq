import Papa from 'papaparse';

/** Base used when a cell is a bare Cursor referral path. */
export const CURSOR_BASE_URL = 'https://cursor.com/';

const URL_HEADER_NAMES = new Set([
  'url',
  'urls',
  'link',
  'links',
  'href',
  'uri',
  'website',
  'web',
]);

/**
 * True if a cell value looks like a URL or URL-ish path we should encode.
 * Intentionally does not treat referral codes (e.g. YAHYA-K8X17RIUV3CP) as URLs.
 */
export function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;

  if (/^https?:\/\//i.test(v)) return true;
  if (/^www\./i.test(v)) return true;
  if (/^(?:www\.)?cursor\.com(?:[/?#]|$)/i.test(v)) return true;
  if (/^referral(?:[/?#]|$)/i.test(v)) return true;

  // Bare domain.tld... (no spaces) — e.g. example.com/path
  if (
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#][^\s]*)?$/i.test(
      v
    )
  ) {
    return true;
  }

  return false;
}

/** Header names that hint at a URL column (do not hard-code "Code"). */
export function isUrlHintHeader(name: string): boolean {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (!normalized) return false;
  if (URL_HEADER_NAMES.has(normalized)) return true;
  return (
    normalized.endsWith('url') ||
    normalized.endsWith('urls') ||
    normalized.endsWith('link') ||
    normalized.endsWith('links')
  );
}

function isReferralPath(value: string): boolean {
  return /^referral(?:[/?#]|$)/i.test(value.trim());
}

/** Normalize a CSV cell into the string we store / encode in the QR. */
export function normalizeCsvUrl(value: string): string {
  const v = value.trim();
  if (!v) return v;
  if (isReferralPath(v)) {
    return `${CURSOR_BASE_URL}${v.replace(/^\//, '')}`;
  }
  return v;
}

function nonEmptyCells(row: string[]): string[] {
  return row.map((c) => (c ?? '').trim()).filter((c) => c.length > 0);
}

/**
 * Detect whether the first row is a header.
 * - Strong signal: any cell looks like a url/link header name
 * - Otherwise: first row has no URL-like values, but later rows do
 */
export function detectHeaderRow(rows: string[][]): boolean {
  if (rows.length === 0) return false;

  const first = rows[0];
  if (first.some((cell) => isUrlHintHeader(cell ?? ''))) {
    return true;
  }

  const firstHasUrl = first.some((cell) => looksLikeUrl(cell ?? ''));
  if (firstHasUrl) return false;

  if (rows.length < 2) return false;

  const laterHasUrl = rows
    .slice(1)
    .some((row) => row.some((cell) => looksLikeUrl(cell ?? '')));
  return laterHasUrl;
}

/**
 * Pick the column that best looks like URLs.
 * Prefers columns whose header is url/link-ish; falls back to value shape.
 */
export function findUrlColumnIndex(
  rows: string[][],
  hasHeader: boolean
): number {
  if (rows.length === 0) return 0;

  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) return 0;

  const colCount = Math.max(
    1,
    ...rows.map((r) => r.length),
    headers.length
  );

  // Single-column: keep old behaviour (column 0)
  if (colCount === 1) return 0;

  let bestCol = 0;
  let bestScore = -1;

  for (let col = 0; col < colCount; col++) {
    let score = 0;

    for (const row of dataRows) {
      const cell = (row[col] ?? '').trim();
      if (!cell) continue;
      if (looksLikeUrl(cell)) score += 2;
    }

    if (hasHeader && isUrlHintHeader(headers[col] ?? '')) {
      // Strong hint — enough to beat a non-URL first column of codes
      score += Math.max(dataRows.length, 1) * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  // If nothing looked like a URL, fall back to column 0 (legacy)
  return bestScore > 0 ? bestCol : 0;
}

export type ExtractCsvUrlsResult = {
  urls: string[];
  urlColumnIndex: number;
  skippedHeader: boolean;
};

/**
 * Parse CSV text and extract one URL per data row from the best URL column.
 * Handles quoted fields, CRLF, and trailing newlines via PapaParse.
 */
export function extractUrlsFromCsv(text: string): ExtractCsvUrlsResult {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
    // Keep fields as strings; trim is applied per-cell below
  });

  const rows = (parsed.data ?? [])
    .map((row) =>
      (Array.isArray(row) ? row : [String(row ?? '')]).map((cell) =>
        String(cell ?? '').trim()
      )
    )
    // Drop fully empty rows (defense in depth beyond skipEmptyLines)
    .filter((row) => nonEmptyCells(row).length > 0);

  if (rows.length === 0) {
    return { urls: [], urlColumnIndex: 0, skippedHeader: false };
  }

  const skippedHeader = detectHeaderRow(rows);
  const urlColumnIndex = findUrlColumnIndex(rows, skippedHeader);
  const dataRows = skippedHeader ? rows.slice(1) : rows;

  const urls: string[] = [];
  for (const row of dataRows) {
    const raw = (row[urlColumnIndex] ?? '').trim();
    if (!raw) continue;
    urls.push(normalizeCsvUrl(raw));
  }

  return { urls, urlColumnIndex, skippedHeader };
}
