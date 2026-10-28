export const TRENDING_RANGES = ['daily', 'weekly', 'monthly']

export const TRENDING_DEFAULT_RANGE = 'weekly'

export const TRENDING_MAX_RESULTS = 1000

const RANGE_DAYS = { daily: 1, weekly: 7, monthly: 30 }

export const POPULAR_LANGUAGES = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'Go',
  'Rust',
  'C++',
  'C',
  'C#',
  'PHP',
  'Ruby',
  'Swift',
  'Kotlin',
  'Dart',
  'Shell',
  'HTML',
  'CSS',
  'Vue',
  'Svelte',
  'Lua',
  'R',
  'Scala',
  'Elixir',
  'Haskell',
  'Objective-C',
  'Perl',
  'Julia',
  'Zig',
  'Nim',
  'Clojure',
  'Erlang',
  'Solidity',
  'Jupyter Notebook',
  'Assembly',
]

export function rangeStart(range, now = Date.now()) {
  const days = RANGE_DAYS[range] || RANGE_DAYS.weekly
  return new Date(now - days * 86400000).toISOString().slice(0, 10)
}

export function trendingQuery({ range = TRENDING_DEFAULT_RANGE, language = '', now = Date.now() } = {}) {
  let query = `created:>${rangeStart(range, now)} stars:>10 forks:>0`
  const lang = String(language || '')
    .trim()
    .replace(/"/g, '')

  if (lang) query += ` language:"${lang}"`
  return query
}

export function trendingPageCount(totalCount, perPage = 24) {
  const total = Math.min(Math.max(Number(totalCount) || 0, 0), TRENDING_MAX_RESULTS)
  return Math.ceil(total / perPage)
}
