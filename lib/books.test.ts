import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAuthors,
  formatResult,
  parsePublishedDate,
  mostCommonAuthor,
  computeAggregates,
  type Volume,
} from './books.ts';

test('formatAuthors joins multiple authors with commas', () => {
  assert.equal(formatAuthors(['A. Smith', 'B. Jones']), 'A. Smith, B. Jones');
});

test('formatAuthors falls back gracefully when authors are missing', () => {
  assert.equal(formatAuthors(undefined), 'Unknown author');
  assert.equal(formatAuthors([]), 'Unknown author');
});

test('formatResult produces "Authors - Title"', () => {
  const volume: Volume = {
    volumeInfo: { title: 'Clean Code', authors: ['Robert C. Martin'] },
  };
  assert.equal(formatResult(volume), 'Robert C. Martin - Clean Code');
});

test('formatResult handles a missing title', () => {
  const volume: Volume = { volumeInfo: { authors: ['Jane Doe'] } };
  assert.equal(formatResult(volume), 'Jane Doe - Untitled');
});

test('parsePublishedDate handles year, year-month, and full dates', () => {
  assert.equal(parsePublishedDate('1999')?.sortKey, 19990101);
  assert.equal(parsePublishedDate('1999-05')?.sortKey, 19990501);
  assert.equal(parsePublishedDate('1999-05-20')?.sortKey, 19990520);
});

test('parsePublishedDate returns null for missing or bad input', () => {
  assert.equal(parsePublishedDate(undefined), null);
  assert.equal(parsePublishedDate('not-a-date'), null);
});

test('mostCommonAuthor tallies across volumes and breaks ties alphabetically', () => {
  const volumes: Volume[] = [
    { volumeInfo: { authors: ['Zoe'] } },
    { volumeInfo: { authors: ['Zoe', 'Amy'] } },
    { volumeInfo: { authors: ['Amy'] } },
  ];
  // Zoe and Amy both appear twice; Amy wins the alphabetical tie-break.
  assert.deepEqual(mostCommonAuthor(volumes), { name: 'Amy', count: 2 });
});

test('mostCommonAuthor returns null when there are no authors', () => {
  assert.equal(mostCommonAuthor([{ volumeInfo: {} }]), null);
});

test('computeAggregates reports true total, sample size, author, and date range', () => {
  const volumes: Volume[] = [
    { volumeInfo: { authors: ['Ada'], publishedDate: '2001' } },
    { volumeInfo: { authors: ['Ada'], publishedDate: '1975-06' } },
    { volumeInfo: { authors: ['Grace'], publishedDate: '2020-01-15' } },
  ];
  const result = computeAggregates(volumes, 12345);
  assert.equal(result.totalItems, 12345);
  assert.equal(result.sampleSize, 3);
  assert.deepEqual(result.mostCommonAuthor, { name: 'Ada', count: 2 });
  assert.equal(result.earliest, '1975-06');
  assert.equal(result.latest, '2020-01-15');
});
