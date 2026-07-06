/* ============================================================
   应用元数据：首页卡片列表。
   全部应用已迁移到 Vue SPA，用 RouterLink 跳转。
   ============================================================ */

export const PROJECTS = [
  {
    name: 'Rate Board', type: 'finance', typeClass: 'finance',
    desc: { en: 'Exchange rates, currency converter, and crypto prices.', zh: '汇率查询、币种换算、加密货币行情。' },
  },
  {
    name: 'Atlas Info', type: 'data', typeClass: 'data',
    desc: { en: 'Country encyclopedia with population, languages, and borders.', zh: '国家百科：人口、语言、邻国等信息。' },
  },
  {
    name: 'Radio Atlas', type: 'media', typeClass: 'media',
    desc: { en: 'Global radio explorer powered by Radio Browser API.', zh: '基于 Radio Browser API 的全球电台探索器。' },
  },
  {
    name: 'Sky Brief', type: 'geo', typeClass: 'geo',
    desc: { en: 'Weather, air quality, 7-day forecast, and city comparison.', zh: '天气、空气质量、7天预报、城市对比。' },
  },
  {
    name: 'Trending Atlas', type: 'data', typeClass: 'data',
    desc: { en: 'Discover trending GitHub repos by day, week, or month.', zh: '按日/周/月发现 GitHub 热门仓库。' },
  },
  {
    name: 'Repo Scope', type: 'data', typeClass: 'data',
    desc: { en: 'GitHub repo analysis and scope overview tool.', zh: 'GitHub 仓库分析与概览工具。' },
  },
  {
    name: 'Node Atlas', type: 'data', typeClass: 'data',
    desc: { en: 'Explore and visualize node/network data.', zh: '节点与网络数据的探索与可视化。' },
  },
  {
    name: 'Hour Bridge', type: 'data', typeClass: 'data',
    desc: { en: 'Time zone bridge — compare times across regions.', zh: '时区桥梁 — 跨区域时间对照。' },
  },
  {
    name: 'Earthquake', type: 'data', typeClass: 'data',
    desc: { en: 'Real-time global seismic activity map.', zh: '全球实时地震监测地图。' },
  },
  {
    name: 'Dev Tools', type: 'data', typeClass: 'data',
    desc: { en: '14 developer tools: CSS/HTML compressor, JSON/SQL formatter, Encode/Decode, Hash, JWT, Regex, Diff, Lorem, UUID, Timestamp, Color, Markdown.', zh: '开发者工具集：CSS 压缩、JSON 格式化等。' },
  },
  {
    name: 'Offday Planner', type: 'data', typeClass: 'data',
    desc: { en: 'Holiday and off-day planner tool.', zh: '假期与休息日规划工具。' },
  },
  {
    name: 'ISS Tracker', type: 'space', typeClass: 'space',
    desc: { en: 'Real-time ISS position tracking with astronaut roster.', zh: '国际空间站实时位置追踪与宇航员名单。' },
  },
  {
    name: 'Book Finder', type: 'media', typeClass: 'media',
    desc: { en: 'Search millions of books from Open Library.', zh: '搜索 Open Library 海量图书。' },
  },
  {
    name: 'QR Forge', type: 'data', typeClass: 'data',
    desc: { en: 'Generate custom QR codes with live preview.', zh: '生成自定义二维码，实时预览。' },
  },
  {
    name: 'Movie Quest', type: 'media', typeClass: 'media',
    desc: { en: 'Search movies and TV shows, view ratings and details.', zh: '搜索电影和电视剧，查看评分和详情。' },
  },
  {
    name: 'Mars Weather', type: 'space', typeClass: 'space',
    desc: { en: 'Weather data from NASA InSight Mars lander.', zh: 'NASA 洞察号火星天气数据。' },
  },
  {
    name: 'Password Vault', type: 'data', typeClass: 'data',
    desc: { en: 'Secure password generator with strength analysis.', zh: '安全密码生成器，含强度分析。' },
  },
  {
    name: 'Markdown Studio', type: 'data', typeClass: 'data',
    desc: { en: 'Markdown editor with live preview and export.', zh: 'Markdown 编辑器，实时预览与导出。' },
  },
  {
    name: 'Aurora Forecast', type: 'space', typeClass: 'space',
    desc: { en: 'NOAA-based aurora forecast with Kp index and visibility map.', zh: '基于 NOAA 的极光预报，含 Kp 指数与可见范围图。' },
  },
  {
    name: 'Launch Board', type: 'space', typeClass: 'space',
    desc: { en: 'Upcoming rocket launches with live countdown.', zh: '即将发射的火箭日程，含实时倒计时。' },
  },
  {
    name: 'Word Forge', type: 'data', typeClass: 'data',
    desc: { en: 'Vocabulary trainer with speech, spelling, and quizzes.', zh: '单词学习，含朗读、拼写、选择题。' },
  },
  {
    name: 'Taste Atlas', type: 'food', typeClass: 'food',
    desc: { en: 'Explore recipes from around the world via TheMealDB.', zh: '通过 TheMealDB 探索全球食谱。' },
  },
  {
    name: 'Meme Forge', type: 'fun', typeClass: 'fun',
    desc: { en: 'Random memes from Reddit by subreddit or fully random.', zh: 'Reddit 随机梗图，可按 subreddit 或完全随机。' },
  },
  {
    name: 'Cocktail Bar', type: 'food', typeClass: 'food',
    desc: { en: 'Search cocktail recipes with ingredients, steps, and glassware.', zh: '鸡尾酒配方搜索：材料、步骤、酒杯。' },
  },
  {
    name: 'HN Reader', slug: 'hn-reader', type: 'data', typeClass: 'data',
    desc: { en: 'Browse Hacker News top stories, Ask HN, Show HN, and jobs.', zh: '浏览 Hacker News 热门文章、Ask HN、Show HN 和招聘。' },
  },
  {
    name: 'Sun & Moon', slug: 'sun-moon', type: 'geo', typeClass: 'geo',
    desc: { en: 'Sunrise, sunset, and twilight times for any city and date.', zh: '任意城市和日期的日出、日落和曙暮光时间。' },
  },
  {
    name: 'Crypto Pulse', slug: 'crypto-pulse', type: 'finance', typeClass: 'finance',
    desc: { en: 'Real-time cryptocurrency prices with 7d trends and market cap.', zh: '实时加密货币价格，含 7 天趋势和市值。' },
  },
  {
    name: 'Air Quality', type: 'geo', typeClass: 'geo',
    desc: { en: 'Real-time air quality index and pollutant details worldwide.', zh: '全球实时空气质量指数和污染物详情。' },
  },
]

/** 生成应用的 URL slug（用于 Vue 路由路径）。 */
export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
