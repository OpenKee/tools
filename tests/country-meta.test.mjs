import test from 'node:test'
import assert from 'node:assert/strict'
import {
  HOLIDAY_COUNTRY_CODES,
  countryCode2,
  countryCode3,
  countryName,
  countryOptions,
  countryCodeByName,
  timeInZone,
  hourInZone,
} from '../src/lib/country-meta.js'

test('ISO codes normalize across alpha-2 and alpha-3', () => {
  assert.equal(countryCode2('cn'), 'CN')
  assert.equal(countryCode2('CHN'), 'CN')
  assert.equal(countryCode2('usa'), 'US')
  assert.equal(countryCode2('XX'), '')
  assert.equal(countryCode3('cn'), 'CHN')
  assert.equal(countryCode3('CHN'), 'CHN')
})

test('country names are localized for supported languages', () => {
  assert.equal(countryName('CN', 'zh'), '中国')
  assert.equal(countryName('US', 'en'), 'United States')
  assert.equal(countryName('CHN', 'zh'), '中国')
  assert.equal(countryName('', 'zh'), '')
})

test('country options include localized names and sort by locale', () => {
  const options = countryOptions(HOLIDAY_COUNTRY_CODES, 'zh')
  assert.equal(options.length, HOLIDAY_COUNTRY_CODES.length)
  assert.deepEqual(
    options.find((o) => o.code === 'CN'),
    { code: 'CN', name: '中国' },
  )
  const names = options.map((o) => o.name)
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, 'zh-CN')),
  )
})

test('country names and codes resolve back to ISO alpha-2', () => {
  assert.equal(countryCodeByName('China'), 'CN')
  assert.equal(countryCodeByName('中国'), 'CN')
  assert.equal(countryCodeByName('cn'), 'CN')
  assert.equal(countryCodeByName('USA'), 'US')
  assert.equal(countryCodeByName('UK'), 'GB')
  assert.equal(countryCodeByName('south korea'), 'KR')
  assert.equal(countryCodeByName('Côte d’Ivoire'), 'CI')
  assert.equal(countryCodeByName('Taiwan, Province of China'), 'TW')
  assert.equal(countryCodeByName('Atlantis'), '')
})

test('time helpers use a 24-hour clock and handle DST', () => {
  const winter = new Date('2026-01-01T05:00:00Z')
  assert.equal(timeInZone(winter, 'America/New_York'), '00:00')
  assert.equal(hourInZone(winter, 'America/New_York'), 0)
  assert.equal(timeInZone(winter, 'Asia/Shanghai'), '13:00')
  assert.equal(hourInZone(winter, 'Asia/Shanghai'), 13)

  const summer = new Date('2026-07-01T05:00:00Z')
  assert.equal(timeInZone(summer, 'America/New_York'), '01:00')
})

test('invalid time zones degrade to empty values', () => {
  assert.equal(timeInZone(new Date(), 'Mars/Olympus_Mons'), '')
  assert.equal(hourInZone(new Date(), 'Mars/Olympus_Mons'), null)
  assert.equal(timeInZone(new Date(), ''), '')
  assert.equal(hourInZone(new Date(), ''), null)
})
