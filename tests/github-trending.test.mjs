import test from 'node:test'
import assert from 'node:assert/strict'
import {
  POPULAR_LANGUAGES,
  TRENDING_DEFAULT_RANGE,
  TRENDING_MAX_RESULTS,
  TRENDING_RANGES,
  rangeStart,
  trendingPageCount,
  trendingQuery,
} from '../src/lib/github-trending.js'

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0)

test('rangeStart uses 1 / 7 / 30 day windows', () => {
  assert.equal(rangeStart('daily', NOW), '2026-10-27')
  assert.equal(rangeStart('weekly', NOW), '2026-10-21')
  assert.equal(rangeStart('monthly', NOW), '2026-09-28')
})

test('rangeStart falls back to the weekly window for unknown ranges', () => {
  assert.equal(rangeStart('nonsense', NOW), rangeStart(TRENDING_DEFAULT_RANGE, NOW))
})

test('trendingQuery includes creation window, star and fork thresholds', () => {
  const q = trendingQuery({ range: 'weekly', now: NOW })
  assert.equal(q, 'created:>2026-10-21 stars:>10 forks:>0')
})

test('trendingQuery quotes language names so C++ and C# survive parsing', () => {
  const q = trendingQuery({ range: 'monthly', language: '  C++  ', now: NOW })
  assert.equal(q, 'created:>2026-09-28 stars:>10 forks:>0 language:"C++"')
})

test('trendingQuery omits the language filter when empty', () => {
  assert.doesNotMatch(trendingQuery({ language: '' }), /language:/)
})

test('default range is weekly because the 24h view is almost always empty', () => {
  assert.equal(TRENDING_DEFAULT_RANGE, 'weekly')
  assert.deepEqual(TRENDING_RANGES, ['daily', 'weekly', 'monthly'])
})

test('popular languages cover the mainstream options without duplicates', () => {
  for (const lang of ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'C++', 'Vue']) {
    assert.ok(POPULAR_LANGUAGES.includes(lang), `${lang} missing`)
  }
  assert.equal(new Set(POPULAR_LANGUAGES).size, POPULAR_LANGUAGES.length)
  assert.ok(POPULAR_LANGUAGES.length <= 40)
})

test('trendingPageCount stops at GitHub’s 1,000-result ceiling', () => {
  assert.equal(trendingPageCount(0, 24), 0)
  assert.equal(trendingPageCount(100, 24), 5)
  assert.equal(trendingPageCount(1153, 24), Math.ceil(TRENDING_MAX_RESULTS / 24))
  assert.equal(trendingPageCount(9993, 24), 42)
  assert.equal(trendingPageCount(-1, 24), 0)
})
