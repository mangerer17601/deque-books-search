'use client';

import { useCallback, useState } from 'react';
import { formatResult, type Aggregates, type Volume } from '@/lib/books';

const PAGE_SIZE = 10;

interface PageResponse {
  items: Volume[];
  totalItems: number;
  startIndex: number;
  responseTimeMs: number;
  error?: string;
}

interface AggregateResponse extends Aggregates {
  responseTimeMs: number;
  error?: string;
}

/**
 * Fetches JSON with a silent client-side retry. Combined with the server
 * route's own retry loop, this makes a user-visible error from a transient
 * Google Books hiccup extremely unlikely.
 */
async function fetchJson<T>(url: string, tries = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const data = (await res.json()) as T & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed.');
      return data;
    } catch (err) {
      lastError = err;
      if (i < tries - 1) await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw lastError;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [items, setItems] = useState<Volume[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [aggregates, setAggregates] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const fetchPage = useCallback(async (q: string, start: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<PageResponse>(
        `/api/search?q=${encodeURIComponent(q)}&startIndex=${start}`
      );
      setItems(data.items);
      setTotalItems(data.totalItems);
      setStartIndex(data.startIndex);
      setResponseTimeMs(data.responseTimeMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAggregates = useCallback(async (q: string) => {
    try {
      const data = await fetchJson<AggregateResponse>(
        `/api/search?q=${encodeURIComponent(q)}&aggregate=1`
      );
      setAggregates(data);
    } catch {
      setAggregates(null);
    }
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setActiveQuery(q);
    setSearched(true);
    setAggregates(null);
    await Promise.all([fetchPage(q, 0), fetchAggregates(q)]);
  };

  const goToPage = (start: number) => {
    if (start < 0 || loading) return;
    fetchPage(activeQuery, start);
  };

  const page = Math.floor(startIndex / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const rangeStart = totalItems === 0 ? 0 : startIndex + 1;
  const rangeEnd = startIndex + items.length;
  const canPrev = startIndex > 0;
  const canNext = items.length === PAGE_SIZE && startIndex + PAGE_SIZE < totalItems;

  const statusMessage = loading
    ? 'Searching…'
    : error
      ? `Error: ${error}`
      : searched
        ? totalItems > 0
          ? `Showing ${rangeStart}–${rangeEnd} of ${totalItems.toLocaleString()} results`
          : 'No results found. Try a different search.'
        : '';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to results
      </a>

      <header className="site-header">
        <h1>Google Books Search</h1>
        <p className="tagline">
          Search millions of titles. Select any result to read its description.
        </p>
      </header>

      <main id="main">
        <form role="search" className="search-form" onSubmit={onSubmit}>
          <label htmlFor="q">Search for books</label>
          <div className="search-row">
            <input
              id="q"
              name="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Harry Potter, machine learning, Jane Austen"
              autoComplete="off"
            />
            <button type="submit" disabled={loading || !query.trim()}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        <div className="status" role="status" aria-live="polite">
          {statusMessage}
        </div>

        {aggregates && (
          <section className="aggregates" aria-label="Search summary">
            <h2>Search summary</h2>
            <dl>
              <div>
                <dt>Total results</dt>
                <dd>{aggregates.totalItems.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Most common author</dt>
                <dd>
                  {aggregates.mostCommonAuthor
                    ? `${aggregates.mostCommonAuthor.name} (${aggregates.mostCommonAuthor.count})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Earliest publication</dt>
                <dd>{aggregates.earliest ?? '—'}</dd>
              </div>
              <div>
                <dt>Most recent publication</dt>
                <dd>{aggregates.latest ?? '—'}</dd>
              </div>
              <div>
                <dt>Server response time</dt>
                <dd>{responseTimeMs ?? aggregates.responseTimeMs} ms</dd>
              </div>
            </dl>
            <p className="agg-note">
              Author and date figures are based on the top {aggregates.sampleSize}{' '}
              matches; total results reflects the full search.
            </p>
          </section>
        )}

        {items.length > 0 && (
          <>
            <ol className="results" aria-label="Search results">
              {items.map((volume, index) => (
                <li key={volume.id ?? index} className="result">
                  <details>
                    <summary>
                      <span className="result-index">{startIndex + index + 1}.</span>
                      <span className="result-label">{formatResult(volume)}</span>
                    </summary>
                    <div className="result-detail">
                      {volume.volumeInfo?.publishedDate && (
                        <p className="result-meta">
                          Published: {volume.volumeInfo.publishedDate}
                        </p>
                      )}
                      <p className="result-description">
                        {volume.volumeInfo?.description?.trim()
                          ? volume.volumeInfo.description
                          : 'No description available for this title.'}
                      </p>
                    </div>
                  </details>
                </li>
              ))}
            </ol>

            <nav className="pagination" aria-label="Search results pages">
              <button
                type="button"
                onClick={() => goToPage(startIndex - PAGE_SIZE)}
                disabled={!canPrev || loading}
              >
                ← Previous
              </button>
              <span className="page-indicator">
                Page {page} of {totalPages.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => goToPage(startIndex + PAGE_SIZE)}
                disabled={!canNext || loading}
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </main>

      <footer className="site-footer">
        <p>Built with Next.js · Data from the Google Books API</p>
      </footer>
    </>
  );
}
