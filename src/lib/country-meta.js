import countryCodes from '../data/country-codes.json' with { type: 'json' }

export const HOLIDAY_COUNTRY_CODES = ['CN', 'US', 'GB', 'JP', 'DE', 'FR', 'KR', 'SG', 'AU', 'CA', 'IN', 'BR']

const CODE3_TO_CODE2 = Object.fromEntries(Object.entries(countryCodes).map(([a2, a3]) => [a3, a2]))

export function countryCode2(code) {
  if (!code) return ''
  const value = String(code).trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(value)) return countryCodes[value] ? value : ''
  if (/^[A-Z]{3}$/.test(value)) return CODE3_TO_CODE2[value] || ''
  return ''
}

export function countryCode3(code) {
  const a2 = countryCode2(code)
  return a2 ? countryCodes[a2] : ''
}

const displayNames = new Map()
const nameCache = new Map()

function displayNamesFor(lang) {
  const key = lang === 'zh' ? 'zh' : 'en'
  if (displayNames.has(key)) return displayNames.get(key)
  let dn = null
  try {
    dn = new Intl.DisplayNames([key === 'zh' ? 'zh-CN' : 'en'], { type: 'region' })
  } catch (e) {}
  displayNames.set(key, dn)
  return dn
}

export function countryName(code, lang = 'en') {
  const a2 = countryCode2(code)
  if (!a2) return code ? String(code) : ''
  const key = (lang === 'zh' ? 'zh' : 'en') + ':' + a2
  if (nameCache.has(key)) return nameCache.get(key)
  let name = a2
  const dn = displayNamesFor(lang)
  if (dn) {
    try {
      name = dn.of(a2) || a2
    } catch (e) {}
  }
  nameCache.set(key, name)
  return name
}

export function countryOptions(codes, lang = 'en') {
  const loc = lang === 'zh' ? 'zh-CN' : 'en'
  return codes
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, loc))
}

const NAME_ALIASES = {
  'united states of america': 'US',
  usa: 'US',
  'great britain': 'GB',
  uk: 'GB',
  russia: 'RU',
  'south korea': 'KR',
  'north korea': 'KP',
  'czech republic': 'CZ',
  'ivory coast': 'CI',
  "cote d'ivoire": 'CI',
  'vatican city': 'VA',
  'taiwan, province of china': 'TW',
  'hong kong sar': 'HK',
  macao: 'MO',
  'palestine, state of': 'PS',
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,'’()]/g, '')
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

let nameIndex = null

function buildNameIndex() {
  nameIndex = new Map()
  for (const a2 of Object.keys(countryCodes)) {
    for (const lang of ['en', 'zh']) {
      const key = normalizeName(countryName(a2, lang))
      if (key && !nameIndex.has(key)) nameIndex.set(key, a2)
    }
  }
  for (const [alias, a2] of Object.entries(NAME_ALIASES)) {
    nameIndex.set(normalizeName(alias), a2)
  }
}

export function countryCodeByName(name) {
  if (!name) return ''
  const direct = countryCode2(name)
  if (direct) return direct
  if (!nameIndex) buildNameIndex()
  return nameIndex.get(normalizeName(name)) || ''
}

export function timeInZone(date, timeZone, loc = 'en-US') {
  if (!timeZone) return ''
  try {
    return new Intl.DateTimeFormat(loc, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date)
  } catch (e) {
    return ''
  }
}

export function hourInZone(date, timeZone) {
  if (!timeZone) return null
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(date),
    )
  } catch (e) {
    return null
  }
}
