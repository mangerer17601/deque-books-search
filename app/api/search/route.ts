import { NextRequest, NextResponse } from 'next/server';
import { computeAggregates, type Volume } from '@/lib/books';

const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const PAGE_SIZE = 10;
const AGGREGATE_SAMPLE_SIZE = 40; // Google Books allows at most 40 per request.

/**
 * Builds a Google Books request URL, attaching an API key only if one is
 * configured (the API works key-less, just with tighter rate limits).
 */
function buildUrl(query: string, startIndex: number, maxResults: number): string {
  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('startIndex', String(startIndex));
  url.searchParams.set('maxResults', String(maxResults));
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) url.searchParams.set('key', key);
  return url.toString();
}

/**
 * Fetches from Google Books while measuring the upstream round-trip time so we
 * can report a real "server response time" to the client.
 */
// Transient upstream statuses worth retrying (Google Books intermittently
// returns 5xx / 429 for individual requests even when the API is healthy).
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function timedFetch(url: string): Promise<{ data: any; responseTimeMs: number }> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = performance.now();
    const res = await fetch(url, { cache: 'no-store' });
    const responseTimeMs = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json();
      return { data, responseTimeMs };
    }

    lastStatus = res.status;
    if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
      await sleep(250 * attempt); // 250ms, then 500ms backoff
      continue;
    }
    break;
  }

  if (lastStatus === 429) {
    throw new Error(
      'Google Books is rate-limiting requests right now. Please try again in a moment.'
    );
  }
  throw new Error(`Google Books responded with ${lastStatus}.`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const isAggregate = searchParams.get('aggregate') === '1';

  if (!query) {
    return NextResponse.json({ error: 'A search query is required.' }, { status: 400 });
  }

  try {
    // Aggregate mode: compute insights over a bounded sample of results.
    if (isAggregate) {
      const url = buildUrl(query, 0, AGGREGATE_SAMPLE_SIZE);
      const { data, responseTimeMs } = await timedFetch(url);
      const items: Volume[] = data.items ?? [];
      const aggregates = computeAggregates(items, data.totalItems ?? 0);
      return NextResponse.json({ ...aggregates, responseTimeMs });
    }

    // Display mode: one page of exactly 10 results.
    const requested = parseInt(searchParams.get('startIndex') ?? '0', 10);
    const startIndex = Number.isFinite(requested) && requested > 0 ? requested : 0;
    const url = buildUrl(query, startIndex, PAGE_SIZE);
    const { data, responseTimeMs } = await timedFetch(url);

    return NextResponse.json({
      items: data.items ?? [],
      totalItems: data.totalItems ?? 0,
      startIndex,
      responseTimeMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
