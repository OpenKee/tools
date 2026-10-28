import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, pad2, parseDateOnly, monthDay, safeExternalUrl } from '../src/lib/format.js'

test('escapeHtml escapes every HTML metacharacter', () => {
  assert.equal(
    escapeHtml(`<a href="x">Tom & 'Jerry'</a>`),
    '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
  )
})

test('escapeHtml treats null and undefined as empty strings', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
  assert.equal(escapeHtml(0), '0')
})

test('escapeHtml does not double-escape the ampersands it just wrote', () => {
  assert.equal(escapeHtml('<'), '&lt;')
  assert.equal(escapeHtml('&lt;'), '&amp;lt;')
})

test('safeExternalUrl accepts only absolute HTTP(S) URLs', () => {
  assert.equal(safeExternalUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1')
  assert.equal(safeExternalUrl(' http://example.com '), 'http://example.com/')
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'ftp://example.com/file',
    '//example.com',
    '/relative',
    'example.com',
    '',
    null,
    undefined,
  ]) {
    assert.equal(safeExternalUrl(value), '', String(value))
  }
})

test('safeExternalUrl rejects malformed URLs without throwing', () => {
  assert.equal(safeExternalUrl('https://'), '')
  assert.equal(safeExternalUrl('http://[invalid'), '')
})

test('safeExternalUrl uses parsed protocols rather than unsafe prefix matching', () => {
  for (const value of [
    'JaVaScRiPt:alert(1)',
    '\u0000javascript:alert(1)',
    'java\nscript:alert(1)',
    '\tdata:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///tmp/file',
    'blob:https://example.com/id',
    'httpsx://example.com',
    'https://example.com@javascript:alert(1)',
    {},
    123,
    {
      toString() {
        throw new Error('must not coerce arbitrary input')
      },
    },
  ])
    assert.equal(safeExternalUrl(value), '')
  assert.equal(safeExternalUrl('HTTPS://EXAMPLE.COM/a?b=1&c=2#part'), 'https://example.com/a?b=1&c=2#part')
  assert.equal(safeExternalUrl('https://example.com/"quoted"'), 'https://example.com/%22quoted%22')
})

test('pad2 always produces two digits', () => {
  assert.equal(pad2(0), '00')
  assert.equal(pad2(7), '07')
  assert.equal(pad2(10), '10')
  assert.equal(pad2(59), '59')
})

test('parseDateOnly keeps the calendar day in every local timezone', () => {
  const d = parseDateOnly('2026-06-19')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 5)
  assert.equal(d.getDate(), 19)
  assert.equal(d.getDay(), 5)
})

test('parseDateOnly falls back to native parsing for non date-only input', () => {
  const d = parseDateOnly('2026-06-19T12:00:00Z')
  assert.equal(d.toISOString(), '2026-06-19T12:00:00.000Z')
})

test('monthDay renders month/day instead of the ambiguous day/month', () => {
  assert.equal(monthDay('2026-05-01'), '5/1')
  assert.equal(monthDay('2026-06-19'), '6/19')
  assert.equal(monthDay('nope'), '')
})
