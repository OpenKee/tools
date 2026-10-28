import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQrData } from '../src/lib/qr.js'

test('QR data preserves plain text and adds standard protocol prefixes', () => {
  assert.equal(buildQrData('text', { text: 'hello' }), 'hello')
  assert.equal(buildQrData('email', { email: 'a@example.com' }), 'mailto:a@example.com')
  assert.equal(buildQrData('phone', { phone: '+123' }), 'tel:+123')
})

test('Wi-Fi QR data escapes delimiters and backslashes in credentials', () => {
  const data = buildQrData('wifi', {
    encryption: 'WPA',
    ssid: 'office;west\\2',
    password: 'p:a,s\\s"word',
  })
  assert.equal(data, 'WIFI:T:WPA;S:office\\;west\\\\2;P:p\\:a\\,s\\\\s\\"word;;')
})

test('Wi-Fi QR data supports open networks and unknown types are empty', () => {
  assert.equal(buildQrData('wifi', { encryption: 'nopass', ssid: 'cafe' }), 'WIFI:T:nopass;S:cafe;P:;;')
  assert.equal(buildQrData('unknown', {}), '')
})
