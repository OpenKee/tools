import { describe, it, expect } from 'vitest'
import { escapeHtml, haversineKm } from './ok'
import { slugify } from './data/projects'

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<b>&"\'</b>')).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;')
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    expect(escapeHtml('a < b > c')).toBe('a &lt; b &gt; c')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('leaves strings without special characters unchanged', () => {
    expect(escapeHtml('plain text')).toBe('plain text')
    expect(escapeHtml('')).toBe('')
  })
})

describe('haversineKm', () => {
  it('computes NYC to LA distance (~3936 km)', () => {
    expect(haversineKm(40.7128, -74.006, 34.0522, -118.2437)).toBeCloseTo(3936, -1)
  })

  it('computes London to Paris distance (~344 km)', () => {
    expect(haversineKm(51.5074, -0.1278, 48.8566, 2.3522)).toBeCloseTo(344, -1)
  })

  it('returns ~0 for the same point', () => {
    expect(haversineKm(52.52, 13.405, 52.52, 13.405)).toBeCloseTo(0, 5)
  })

  it('computes antipodal distance (~half Earth circumference)', () => {
    expect(haversineKm(0, 0, 0, 180)).toBeCloseTo(20015.09, 0)
  })
})

describe('slugify', () => {
  it('slugifies a basic name', () => {
    expect(slugify('Trip Prep')).toBe('trip-prep')
    expect(slugify('Repo Deep Dive')).toBe('repo-deep-dive')
  })

  it('strips accents and lowercases', () => {
    expect(slugify('Crème Brûlée')).toBe('creme-brulee')
    expect(slugify('Café Délice')).toBe('cafe-delice')
  })

  it('handles special characters and ampersands', () => {
    expect(slugify('Hello, World! & More')).toBe('hello-world-more')
    expect(slugify('123 Easy Street')).toBe('123-easy-street')
  })

  it('handles empty and edge cases', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})
