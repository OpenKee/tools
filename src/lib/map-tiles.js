export const MAP_ATTRIBUTION = '&copy; Esri'

export const MAP_TILE_URLS = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
}

export function mapTileUrl(theme) {
  return theme === 'light' ? MAP_TILE_URLS.light : MAP_TILE_URLS.dark
}
