import test from 'node:test'
import assert from 'node:assert/strict'
import { MAP_TILE_URLS, mapTileUrl } from '../src/lib/map-tiles.js'

test('mapTileUrl picks the light and dark Esri basemaps', () => {
  assert.equal(mapTileUrl('light'), MAP_TILE_URLS.light)
  assert.equal(mapTileUrl('dark'), MAP_TILE_URLS.dark)
})

test('mapTileUrl defaults to the dark basemap for unknown themes', () => {
  assert.equal(mapTileUrl(undefined), MAP_TILE_URLS.dark)
  assert.equal(mapTileUrl('sepia'), MAP_TILE_URLS.dark)
})

test('basemap URLs are Esri Gray Canvas tiles', () => {
  assert.match(MAP_TILE_URLS.dark, /World_Dark_Gray_Base/)
  assert.match(MAP_TILE_URLS.light, /World_Light_Gray_Base/)
})
