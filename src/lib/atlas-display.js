import { i18nState } from '../i18n.js'
import { locale } from '../ok.js'
import { countryName as intlCountryName } from './country-meta.js'
import countryFacts from '../data/country-facts.json' with { type: 'json' }

export const REGIONS = [
  { k: '', l: { en: 'All', zh: '全部' } },
  { k: 'africa', l: { en: 'Africa', zh: '非洲' } },
  { k: 'americas', l: { en: 'Americas', zh: '美洲' } },
  { k: 'asia', l: { en: 'Asia', zh: '亚洲' } },
  { k: 'europe', l: { en: 'Europe', zh: '欧洲' } },
  { k: 'oceania', l: { en: 'Oceania', zh: '大洋洲' } },
  { k: 'antarctic', l: { en: 'Antarctic', zh: '南极洲' } },
]
export const REGION_KEYS = REGIONS.map((r) => r.k).filter(Boolean)
export const VALID_SORTS = ['pop', 'area', 'density', 'name']

const REGION_ZH = {
  Africa: '非洲',
  Americas: '美洲',
  Asia: '亚洲',
  Europe: '欧洲',
  Oceania: '大洋洲',
  Antarctic: '南极洲',
}

const SUBREGION_ZH = {
  'Australia and New Zealand': '澳大利亚与新西兰',
  Caribbean: '加勒比地区',
  'Central America': '中美洲',
  'Central Asia': '中亚',
  'Central Europe': '中欧',
  'Eastern Africa': '东非',
  'Eastern Asia': '东亚',
  'Eastern Europe': '东欧',
  Melanesia: '美拉尼西亚',
  Micronesia: '密克罗尼西亚',
  'Middle Africa': '中非',
  'North America': '北美洲',
  'Northern Africa': '北非',
  'Northern Europe': '北欧',
  Polynesia: '波利尼西亚',
  'South America': '南美洲',
  'South-Eastern Asia': '东南亚',
  'Southeast Europe': '东南欧',
  'Southern Africa': '南部非洲',
  'Southern Asia': '南亚',
  'Southern Europe': '南欧',
  'Western Africa': '西非',
  'Western Asia': '西亚',
  'Western Europe': '西欧',
}

const UN_GROUP_ZH = {
  'Asia and the Pacific Group': '亚洲及太平洋组',
  'African Group': '非洲组',
  'Eastern European Group': '东欧组',
  'Western European and Others Group': '西欧及其他组',
  'Latin American and Caribbean Group': '拉丁美洲和加勒比组',
}

const GOV_ZH = {
  'Administrated by the UN': '联合国托管',
  'Autonomous Area': '自治地区',
  'Co-administrated': '共管地区',
  'Commonwealth of the US': '美国自治邦',
  'Constitutional Monarchy': '君主立宪制',
  'Constitutional Monarchy (Emirate)': '君主立宪制（酋长国）',
  'Constitutional Monarchy, Federation': '联邦君主立宪制',
  'Dependent Territory of Norway': '挪威属地',
  'Dependent Territory of the UK': '英国属地',
  'Dependent Territory of the US': '美国属地',
  'Emirate Federation': '酋长国联邦',
  'Federal Republic': '联邦共和国',
  'Federal parliamentary republic': '联邦议会制共和国',
  Federation: '联邦制',
  'Federation Constitutional Monarchy': '联邦君主立宪制',
  'Independent Church State': '独立教会国家',
  'Islamic Emirate': '伊斯兰酋长国',
  'Islamic Republic': '伊斯兰共和国',
  Monarchy: '君主制',
  'Monarchy (Emirate)': '君主制（酋长国）',
  'Monarchy (Sultanate)': '君主制（苏丹国）',
  'Nonmetropolitan Territory of France': '法国海外领地',
  'Nonmetropolitan Territory of New Zealand': '新西兰属地',
  'Nonmetropolitan Territory of The Netherlands': '荷兰属地',
  'Occupied by Morocco': '摩洛哥占领',
  'Overseas Department of France': '法国海外省',
  'Parliamentary Coprincipality': '议会制共治公国',
  'Parliamentary Republic': '议会制共和国',
  'Part of Denmark': '丹麦王国的一部分',
  "People's Republic": '人民共和国',
  Republic: '共和国',
  'Socialistic Republic': '社会主义共和国',
  'Socialistic State': '社会主义国家',
  'Special Administrative Region of China': '中国特别行政区',
  'Territorial Collectivity of France': '法国海外集体',
  'Territory of Australia': '澳大利亚属地',
  'US Territory': '美国属地',
  'Unitary Semi-Presidential Republic': '单一制半总统制共和国',
  'Presidential Republic': '总统制共和国',
  'Federal Presidential Republic': '联邦总统制共和国',
  'Crown Dependency': '皇家属地',
  'British Overseas Territory': '英国海外领地',
  'Overseas Territory of France': '法国海外领地',
  'Overseas Collectivity of France': '法国海外集体',
  'Special Municipality of the Netherlands': '荷兰特别市',
  'Constituent Country of the Kingdom of the Netherlands': '荷兰王国构成国',
  'Ecclesiastical Monarchy': '教会君主制',
  'Semi-presidential Republic': '半总统制共和国',
}

const LANG_ZH = {
  bar: '奥地利-巴伐利亚德语',
  bjz: '伯利兹克里奥尔语',
  zdj: '科摩罗语',
  ber: '柏柏尔语',
  mey: '哈桑尼亚语',
  hif: '斐济印地语',
  nfr: '根西语',
  pov: '上几内亚克里奥尔语',
  jam: '牙买加土语',
  nrf: '泽西语',
  cal: '卡罗林语',
  hgm: '科伊科伊语',
  kwn: '夸恩加利语',
  pih: '诺福克语',
  smi: '萨米语',
  nzs: '新西兰手语',
  bwg: '奇巴尔韦语',
  kck: '卡兰加语',
  khi: '科伊桑语',
  ndc: '恩达乌语',
  toi: '通加语',
  zib: '津巴布韦手语',
}

const CURRENCY_ZH = {
  CKD: '库克群岛元',
  FOK: '法罗克朗',
  GGP: '根西镑',
  IMP: '马恩岛镑',
  JEP: '泽西镑',
  KID: '基里巴斯元',
  TVD: '图瓦卢元',
  ZWB: '津巴布韦债券元',
}

const AREA_OVERRIDE = {
  SJM: 62045,
}

const NAME_ZH_OVERRIDE = {
  TWN: { common: '台湾', official: '台湾' },
  MKD: { common: '北马其顿', official: '北马其顿共和国' },
  BES: { common: '荷兰加勒比区' },
  DOM: { common: '多米尼加', official: '多米尼加共和国' },
  DMA: { common: '多米尼克', official: '多米尼克国' },
  COG: { common: '刚果共和国', official: '刚果共和国' },
  COD: { common: '刚果民主共和国', official: '刚果民主共和国' },
  SJM: { common: '斯瓦尔巴和扬马延' },
  HMD: { common: '赫德岛和麦克唐纳群岛' },
  ATF: { common: '法属南部和南极领地' },
  CCK: { common: '科科斯（基林）群岛' },
  REU: { common: '留尼汪' },
  MAF: { common: '法属圣马丁' },
  SXM: { common: '荷属圣马丁' },
  SHN: { common: '圣赫勒拿' },
}

const CAPITAL_ZH_OVERRIDE = {
  GTM: ['危地马拉城'],
  NIC: ['马那瓜'],
  JAM: ['金斯敦'],
  GMB: ['班珠尔'],
  BWA: ['哈博罗内'],
  CPV: ['普拉亚'],
  SYC: ['维多利亚'],
  LIE: ['瓦杜兹'],
  DJI: ['吉布提市'],
  MMR: ['内比都'],
  SAU: ['利雅得'],
  KAZ: ['阿斯塔纳'],
  SOM: ['摩加迪沙'],
  RWA: ['基加利'],
  CRI: ['圣何塞'],
  DOM: ['圣多明各'],
  BLZ: ['贝尔莫潘'],
  BGR: ['索菲亚'],
}

function isZh() {
  return i18nState.lang === 'zh'
}

export function countryName(c) {
  if (!isZh()) return c.name?.common || ''
  const intl = intlCountryName(c.cca2, 'zh')
  return (
    NAME_ZH_OVERRIDE[c.cca3]?.common ||
    c.translations?.zho?.common ||
    (intl && intl !== c.cca2 ? intl : '') ||
    c.name?.common ||
    ''
  )
}

export function countryOfficial(c) {
  if (!isZh()) return c.name?.official || ''
  return NAME_ZH_OVERRIDE[c.cca3]?.official || c.translations?.zho?.official || c.name?.official || ''
}

export function regionTextFor(c) {
  const raw = c.region || ''
  return isZh() ? REGION_ZH[raw] || raw || '—' : raw || '—'
}

export function subregionTextFor(c) {
  const raw = c.subregion || ''
  return isZh() ? SUBREGION_ZH[raw] || raw || '—' : raw || '—'
}

const displayCache = new Map()
function displayName(type, code, fallback) {
  if (!isZh()) return fallback
  const key = type + ':' + code
  if (displayCache.has(key)) return displayCache.get(key)
  let out = fallback
  try {
    const dn = new Intl.DisplayNames([locale()], { type })
    const val = dn.of(code)
    if (val && val !== code) out = val
  } catch (e) {}
  displayCache.set(key, out)
  return out
}

export function languageNames(c) {
  const entries = Object.entries(c.languages || {})
  if (!entries.length) return []
  return entries.map(([code, name]) => (isZh() ? LANG_ZH[code] || displayName('language', code, name) : name))
}

export function currencyNames(c) {
  const entries = Object.entries(c.currencies || {})
  return entries.map(([code, info]) => {
    const name = isZh() ? CURRENCY_ZH[code] || displayName('currency', code, info.name) : info.name
    const symbol = info.symbol ? ' ' + info.symbol : ''
    return `${name} (${code}${symbol})`
  })
}

export function joinList(list, max) {
  if (!list.length) return '—'
  const shown = max && list.length > max ? list.slice(0, max) : list
  const text = shown.join(isZh() ? '、' : ', ')
  return max && list.length > max ? text + (isZh() ? ' 等' : ', etc.') : text
}

export function capitalTextFor(c) {
  const f = countryFacts[c.cca3] || {}
  const zhCaps = CAPITAL_ZH_OVERRIDE[c.cca3] || (f.capitalZh || []).filter(Boolean)
  const list = isZh() && zhCaps.length ? zhCaps : c.capital || []
  return list.length ? list.join(isZh() ? '、' : ', ') : '—'
}

export function densityText(value, digits = 0) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  if (value > 0 && value < 1) return '<1'
  return fmt(value, digits)
}

export function iddTextFor(c) {
  if (!c.idd?.root) return '—'
  const suffixes = c.idd.suffixes || []
  if (suffixes.length === 1) return c.idd.root + suffixes[0]
  return c.idd.root + (suffixes.length ? ' …' : '')
}

export function timezoneInfo(c) {
  const f = countryFacts[c.cca3] || {}
  let zones = (f.timezones || []).slice()
  if (f.capitalTimezone) {
    if (zones.includes(f.capitalTimezone)) {
      zones = [f.capitalTimezone, ...zones.filter((z) => z !== f.capitalTimezone)]
    } else if (!zones.length) {
      zones = [f.capitalTimezone]
    }
  }
  if (!zones.length) return { text: '—', title: '' }
  const shown = zones.slice(0, 3).join('、')
  const more = zones.length - 3
  const text = more > 0 ? shown + (isZh() ? ` 等 ${zones.length} 个时区` : ` +${more} more`) : shown
  return { text, title: zones.join('\n') }
}

export function governmentTextFor(c, t) {
  const raw = countryFacts[c.cca3]?.government
  if (!raw) return t('noData')
  return isZh() ? GOV_ZH[raw] || raw : raw
}

export function drivingTextFor(c, t) {
  const side = countryFacts[c.cca3]?.drive
  if (!side) return t('noData')
  return side === 'left' ? t('drivesLeft') : t('drivesRight')
}

export function unGroupTextFor(c) {
  const raw = c.unRegionalGroup || ''
  return isZh() ? UN_GROUP_ZH[raw] || raw || '—' : raw || '—'
}

export function codesTextFor(c) {
  const parts = []
  if (c.cca2) parts.push(c.cca2)
  if (c.cca3) parts.push(c.cca3)
  if (c.ccn3) parts.push(c.ccn3)
  if (c.cioc) parts.push('IOC ' + c.cioc)
  return parts.length ? parts.join(' · ') : '—'
}

export function altNamesTextFor(c) {
  const base = new Set([countryName(c), countryOfficial(c), c.name?.common, c.name?.official, c.cca2, c.cca3, c.ccn3])
  const unique = []
  for (const name of c.altSpellings || []) {
    if (name && !base.has(name) && !unique.includes(name)) unique.push(name)
  }
  return unique.length ? unique.slice(0, 4).join(isZh() ? '、' : ', ') : '—'
}

const numCache = new Map()
const usdCache = new Map()

function numFmt(digits = 0) {
  const key = locale() + ':' + digits
  if (!numCache.has(key)) {
    numCache.set(key, new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }))
  }
  return numCache.get(key)
}

export function fmt(n, digits = 0) {
  const v = Number(n)
  if (n == null || !Number.isFinite(v)) return '—'
  return numFmt(digits).format(v)
}

export function fmtUsd(n, compact = false) {
  const v = Number(n)
  if (n == null || !Number.isFinite(v)) return '—'
  const key = locale() + ':' + (compact ? 'c' : 's')
  if (!usdCache.has(key)) {
    usdCache.set(
      key,
      new Intl.NumberFormat(locale(), {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 2 : 0,
      }),
    )
  }
  return usdCache.get(key).format(v)
}

export function fmtPct(n, signed = false) {
  const v = Number(n)
  if (n == null || !Number.isFinite(v)) return '—'
  const text = numFmt(1).format(v)
  return (signed && v > 0 ? '+' : '') + text + '%'
}

export function fmtArea(n) {
  if (n == null) return '—'
  return fmt(n, Number(n) < 10 ? 2 : 0)
}

export function fmtStat(value, kind) {
  switch (kind) {
    case 'usd':
      return fmtUsd(value)
    case 'usdCompact':
      return fmtUsd(value, true)
    case 'pct':
      return fmtPct(value)
    case 'pctSigned':
      return fmtPct(value, true)
    case 'num1':
      return fmt(value, 1)
    case 'years':
      return fmt(value, 1) + (isZh() ? ' 岁' : ' yrs')
    case 'co2':
      return fmt(value, 1) + ' t'
    default:
      return fmt(value)
  }
}

export function buildSearchText(c) {
  const f = countryFacts[c.cca3] || {}
  return [
    countryName(c),
    countryOfficial(c),
    c.name?.common,
    c.name?.official,
    c.translations?.zho?.common,
    c.translations?.zho?.official,
    ...(c.altSpellings || []),
    ...(c.capital || []),
    ...(f.capitalZh || []).filter(Boolean),
    ...(CAPITAL_ZH_OVERRIDE[c.cca3] || []),
    c.cca2,
    c.cca3,
    c.ccn3,
    c.cioc,
    c.region,
    c.subregion,
    REGION_ZH[c.region],
    SUBREGION_ZH[c.subregion],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function areaValue(c) {
  const area = Number(AREA_OVERRIDE[c.cca3] ?? c.area)
  return Number.isFinite(area) && area > 0 ? area : null
}

export function densityValue(c) {
  const pop = c.stats?.population?.value
  const area = areaValue(c)
  return pop != null && area ? pop / area : null
}

export function flagImg(cca2, w) {
  return `https://flagcdn.com/w${w}/${(cca2 || '').toLowerCase()}.png`
}
