# Google Books Search

An accessible book search app built on the [Google Books API](https://developers.google.com/books). Built with **Next.js (App Router) + TypeScript** and deployed on **Vercel**.

> **Live demo:** _added after deployment_

This is Challenge 1 of the Deque Solutions Engineer take-home.

## Features

Every core requirement from the challenge, plus an accessibility-first build (fitting for Deque):

| Requirement | How it's met |
| --- | --- |
| **Pagination — exactly 10 per page** | The API is called with `maxResults=10`; Previous/Next controls move by 10 and disable at the bounds. |
| **`Author[, Author…] - Title` formatting** | `formatResult()` joins all authors with commas and appends the title; missing authors render as `Unknown author`. |
| **Expandable descriptions** | Each result is a native, keyboard-accessible `<details>` disclosure. A missing description shows a graceful *"No description available for this title."* |
| **Total number of results** | Taken directly from the API's `totalItems` (the true total across the whole search). |
| **Most common author** | Tallied across a sample of results; ties broken alphabetically for determinism. |
| **Earliest & most recent publication dates** | `publishedDate` values (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`) are normalized and the min/max are shown, preserving the original granularity. |
| **Server response time** | Measured server-side around the upstream Google Books fetch and returned to the client, shown in ms. |

## A note on the aggregated data (a deliberate design decision)

The challenge asks for aggregates across **"the search as a whole."** Google Books can match thousands of volumes but returns at most **40 per request**, so computing the most-common author or the full date range over *every* match would mean dozens of API calls per search.

The approach here:

- **Total results** uses the API's real `totalItems` — accurate for the entire search.
- **Most common author** and **earliest / most recent dates** are computed over a **bounded sample of the top 40 matches**, and the UI labels them as such (*"based on the top N matches"*).

This keeps the app fast and honest. The sample size is a single constant (`AGGREGATE_SAMPLE_SIZE` in [`app/api/search/route.ts`](app/api/search/route.ts)) — trivial to raise if broader aggregation were desired.

## Architecture

```
Browser ──► /api/search (Next.js route handler) ──► Google Books API
```

The Google Books call happens **server-side** in a route handler, which:

1. avoids browser CORS issues,
2. lets us measure a real server response time, and
3. keeps aggregation logic off the client.

Two request modes share one handler:

- `GET /api/search?q=<query>&startIndex=<n>` → one page of 10 results + `totalItems` + `responseTimeMs`.
- `GET /api/search?q=<query>&aggregate=1` → the aggregate summary over the top-40 sample.

The client fetches aggregates **once per new search** and a single page per pagination step.

### Key files

- [`lib/books.ts`](lib/books.ts) — pure, framework-free helpers (`formatAuthors`, `formatResult`, `parsePublishedDate`, `mostCommonAuthor`, `computeAggregates`).
- [`lib/books.test.ts`](lib/books.test.ts) — unit tests for those helpers.
- [`app/api/search/route.ts`](app/api/search/route.ts) — the Google Books route handler.
- [`app/page.tsx`](app/page.tsx) — search UI, results, pagination, and the summary panel.
- [`app/globals.css`](app/globals.css) — minimal, accessible styling (light + dark).

## Accessibility

- Semantic landmarks (`header` / `main` / `footer`), a skip link, and a single `<h1>`.
- A labeled `role="search"` form and an `aria-live` status region announcing result counts and errors.
- Expand/collapse via native `<details>`/`<summary>` — keyboard operable out of the box.
- Visible focus indicators, sufficient color contrast, and a responsive dark mode.
- Verified with **axe** (zero violations) — the same engine behind Deque's tooling.

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm test           # runs the unit tests (Node's built-in test runner)
```

### Optional: Google Books API key

The app works without a key (Google rate-limits by IP). To raise limits, set:

```bash
GOOGLE_BOOKS_API_KEY=your_key_here
```

in `.env.local` (or as a Vercel environment variable).

## Deployment

Deployed on Vercel. Any push to the default branch triggers a production build.

```bash
vercel --prod
```
