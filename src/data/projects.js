export const PROJECTS = [
  {
    name: 'Space Now',
    nameZh: '此刻太空',
    type: 'space',
    typeClass: 'space',
    desc: {
      en: 'A live overview of Earth, the night sky, and Mars.',
      zh: '地球、星空与火星的实时概览。',
    },
  },
  {
    name: 'Repo Lens',
    nameZh: '仓库分析台',
    type: 'data',
    typeClass: 'data',
    desc: {
      en: 'Trending repositories, user overviews, library search, and repo details.',
      zh: 'GitHub 趋势、用户概览、库搜索与仓库详情。',
    },
  },

  {
    name: 'Node Atlas',
    nameZh: '节点情报',
    type: 'data',
    typeClass: 'data',
    desc: {
      en: 'IP, DNS, certificate, latency, and HTTP reachability lookups.',
      zh: 'IP、DNS、证书、延迟与 HTTP 可达性查询。',
    },
  },

  {
    name: 'Rate Board',
    nameZh: '汇率看板',
    type: 'finance',
    typeClass: 'finance',
    desc: { en: 'Exchange rates, crypto prices, and multi-asset conversion.', zh: '汇率、加密货币行情与多资产换算。' },
  },
  {
    name: 'Atlas Info',
    nameZh: '国家百科',
    type: 'data',
    typeClass: 'data',
    desc: {
      en: 'Country profiles with population, economy, society, and geography.',
      zh: '国家人口、经济、社会与地理信息。',
    },
  },
  {
    name: 'Radio Atlas',
    nameZh: '全球电台',
    type: 'media',
    typeClass: 'media',
    desc: {
      en: 'Discover global radio stations by region, tag, and language.',
      zh: '按地区、风格和语言搜索全球电台。',
    },
  },
  {
    name: 'Time & Leave',
    nameZh: '时间与假期',
    type: 'tool',
    typeClass: 'tool',
    desc: {
      en: 'Plan fair meetings across time zones and review holiday dates.',
      zh: '跨时区会议规划与假期日期查询。',
    },
  },
  {
    name: 'Dev Tools',
    nameZh: '开发者工具',
    type: 'tool',
    typeClass: 'tool',
    desc: {
      en: 'Markdown editing, QR code generation, and password tools.',
      zh: 'Markdown 编辑、二维码生成与密码工具。',
    },
  },
  {
    name: 'Food & Drinks',
    nameZh: '美食与调酒',
    slug: 'food',
    type: 'food',
    typeClass: 'food',
    desc: {
      en: 'Browse recipes and cocktail recipes in one tabbed app.',
      zh: '全球食谱与鸡尾酒配方，一个应用分栏呈现。',
    },
  },
  {
    name: 'Meme Forge',
    nameZh: '梗图工坊',
    type: 'fun',
    typeClass: 'fun',
    desc: {
      en: 'Browse random Reddit memes by subreddit or fully at random.',
      zh: '按版块浏览 Reddit 梗图，也可完全随机。',
    },
  },
  {
    name: 'HN Reader',
    nameZh: 'HN 阅读器',
    slug: 'hn-reader',
    type: 'data',
    typeClass: 'data',
    desc: {
      en: 'Read Hacker News top stories, Ask HN, Show HN, and jobs.',
      zh: '浏览 Hacker News 热门、问答、分享与招聘。',
    },
  },
]

export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
