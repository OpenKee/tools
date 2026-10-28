const CONTINENTS = [
  [25, 72, -168, -52, 'North America', '北美洲'],
  [-56, 13, -82, -34, 'South America', '南美洲'],
  [36, 71, -10, 40, 'Europe', '欧洲'],
  [-35, 37, -18, 52, 'Africa', '非洲'],
  [5, 77, 40, 145, 'Asia', '亚洲'],
  [-10, 25, 95, 141, 'Southeast Asia', '东南亚'],
  [-44, -10, 112, 154, 'Australia', '澳大利亚'],
  [60, 83, -55, -20, 'Greenland', '格陵兰'],
]

const OCEANS = [
  [-60, 60, -180, -130, 'Pacific Ocean', '太平洋'],
  [-60, 60, 120, 180, 'Pacific Ocean', '太平洋'],
  [-60, 60, -70, -15, 'Atlantic Ocean', '大西洋'],
  [-30, 25, 45, 100, 'Indian Ocean', '印度洋'],
]

export function detectRegion(lat, lon) {
  if (lat > 66.5) return { en: 'Arctic region', zh: '北极地区' }
  if (lat < -66.5) return { en: 'Antarctic region', zh: '南极地区' }

  for (const c of CONTINENTS) {
    if (lat >= c[0] && lat <= c[1] && lon >= c[2] && lon <= c[3]) {
      return { en: c[4], zh: c[5] }
    }
  }
  for (const o of OCEANS) {
    if (lat >= o[0] && lat <= o[1] && lon >= o[2] && lon <= o[3]) {
      return { en: o[4], zh: o[5] }
    }
  }
  return { en: 'Open ocean', zh: '开阔海域' }
}
