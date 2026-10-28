import test from 'node:test'
import assert from 'node:assert/strict'
import { i18nState } from '../src/i18n.js'
import {
  areaValue,
  buildSearchText,
  capitalTextFor,
  countryName,
  countryOfficial,
  densityText,
  densityValue,
  flagImg,
  fmtArea,
  fmtPct,
  fmtStat,
  joinList,
  regionTextFor,
} from '../src/lib/atlas-display.js'

function withLang(lang, run) {
  const previous = i18nState.lang
  i18nState.lang = lang
  try {
    run()
  } finally {
    i18nState.lang = previous
  }
}

const taiwan = {
  cca2: 'TW',
  cca3: 'TWN',
  name: { common: 'Taiwan', official: 'Republic of China (Taiwan)' },
  translations: { zho: { common: '臺灣', official: '中華民國' } },
  region: 'Asia',
  subregion: 'Eastern Asia',
  capital: ['Taipei'],
  area: 36193,
  stats: { population: { value: 23400000 } },
}

test('country localization follows the current language', () => {
  withLang('en', () => {
    assert.equal(countryName(taiwan), 'Taiwan')
    assert.equal(countryOfficial(taiwan), 'Republic of China (Taiwan)')
    assert.equal(regionTextFor(taiwan), 'Asia')
    assert.equal(fmtStat(72, 'years'), '72 yrs')
  })
  withLang('zh', () => {
    assert.equal(countryName(taiwan), '台湾')
    assert.equal(countryOfficial(taiwan), '台湾')
    assert.equal(regionTextFor(taiwan), '亚洲')
    assert.equal(fmtStat(72, 'years'), '72 岁')
  })
})

test('area and density use the same overrides and fallbacks', () => {
  assert.equal(areaValue({ cca3: 'SJM', area: -1 }), 62045)
  assert.equal(areaValue({ cca3: 'AAA', area: -1 }), null)
  assert.equal(Math.round(densityValue(taiwan)), 647)
  assert.equal(densityText(0.5), '<1')
  assert.equal(densityText(null), '—')
  assert.equal(fmtArea(9.5), '9.5')
  assert.equal(fmtPct(2.5, true), '+2.5%')
})

test('search text retains localized capitals and regions', () => {
  const guatemala = {
    cca2: 'GT',
    cca3: 'GTM',
    name: { common: 'Guatemala', official: 'Republic of Guatemala' },
    capital: ['Guatemala City'],
    region: 'Americas',
    subregion: 'Central America',
  }
  withLang('en', () => {
    assert.equal(capitalTextFor(guatemala), 'Guatemala City')
  })
  withLang('zh', () => {
    assert.equal(capitalTextFor(guatemala), '危地马拉城')
  })
  const text = buildSearchText(guatemala)
  assert.ok(text.includes('危地马拉城'))
  assert.ok(text.includes('美洲'))
  assert.ok(text.includes('中美洲'))
})

test('list and flag formatting keep their existing shapes', () => {
  withLang('en', () => assert.equal(joinList(['A', 'B', 'C'], 2), 'A, B, etc.'))
  withLang('zh', () => assert.equal(joinList(['甲', '乙', '丙'], 2), '甲、乙 等'))
  assert.equal(joinList([]), '—')
  assert.equal(flagImg('TW', 40), 'https://flagcdn.com/w40/tw.png')
})
