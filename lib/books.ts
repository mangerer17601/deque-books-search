/**
 * Pure helpers for shaping Google Books API data.
 *
 * These are intentionally free of any framework or network code so they can be
 * unit-tested in isolation (see lib/books.test.ts) and reused on both the server
 * (route handler) and the client (rendering).
 */

export interface VolumeInfo {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  description?: string;
}

export interface Volume {
  id?: string;
  volumeInfo?: VolumeInfo;
}

/**
 * Formats an author list as: "First author[, second author[, third author...]]".
 * Falls back gracefully when the API omits authors.
 */
export function formatAuthors(authors?: string[]): string {
  if (!authors || authors.length === 0) return 'Unknown author';
  return authors.join(', ');
}

/**
 * Formats a single result as: "First author[, second author...] - Title".
 */
export function formatResult(volume: Volume): string {
  const title = volume.volumeInfo?.title?.trim() || 'Untitled';
  return `${formatAuthors(volume.volumeInfo?.authors)} - ${title}`;
}

export interface ParsedDate {
  raw: string;
  /** Sortable numeric key (YYYYMMDD), missing month/day default to 01. */
  sortKey: number;
  /** Human-readable string, preserving the granularity the API provided. */
  display: string;
}

/**
 * Google Books `publishedDate` can be "YYYY", "YYYY-MM", "YYYY-MM-DD", or absent.
 * Returns null when the value is missing or unparseable so callers can skip it.
 */
export function parsePublishedDate(dateStr?: string): ParsedDate | null {
  if (!dateStr) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(dateStr.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = match[2] ? parseInt(match[2], 10) : 1;
  const day = match[3] ? parseInt(match[3], 10) : 1;
  return {
    raw: dateStr,
    sortKey: year * 10000 + month * 100 + day,
    display: dateStr,
  };
}

export interface AuthorCount {
  name: string;
  count: number;
}

/**
 * Tallies every author across the given volumes and returns the most frequent.
 * Ties are broken alphabetically so the result is deterministic. Returns null
 * when no authors are present.
 */
export function mostCommonAuthor(volumes: Volume[]): AuthorCount | null {
  const counts = new Map<string, number>();
  for (const volume of volumes) {
    for (const author of volume.volumeInfo?.authors ?? []) {
      counts.set(author, (counts.get(author) ?? 0) + 1);
    }
  }

  let best: AuthorCount | null = null;
  for (const [name, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count && name.localeCompare(best.name) < 0)
    ) {
      best = { name, count };
    }
  }
  return best;
}

export interface Aggregates {
  /** True total from the API (across the entire search, not just the sample). */
  totalItems: number;
  /** How many volumes the author/date figures were computed over. */
  sampleSize: number;
  mostCommonAuthor: AuthorCount | null;
  earliest: string | null;
  latest: string | null;
}

/**
 * Computes the aggregate insights the challenge asks for over a sample of
 * volumes. `totalItems` is passed through from the API's true total.
 */
export function computeAggregates(volumes: Volume[], totalItems: number): Aggregates {
  let earliest: ParsedDate | null = null;
  let latest: ParsedDate | null = null;

  for (const volume of volumes) {
    const parsed = parsePublishedDate(volume.volumeInfo?.publishedDate);
    if (!parsed) continue;
    if (!earliest || parsed.sortKey < earliest.sortKey) earliest = parsed;
    if (!latest || parsed.sortKey > latest.sortKey) latest = parsed;
  }

  return {
    totalItems,
    sampleSize: volumes.length,
    mostCommonAuthor: mostCommonAuthor(volumes),
    earliest: earliest?.display ?? null,
    latest: latest?.display ?? null,
  };
}
