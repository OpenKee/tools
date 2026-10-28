# Tools

开箱即用的小工具集合。

## 工具

- **Repo Lens** — 仓库分析台：趋势 / 用户 / 库搜索 / 仓库详情
- **Space Now** — 此刻太空：实时概览 / 今晚观星 / 极光预报 / 空间站追踪 / 发射日程 / 地震地图 / 火星天气
- **Rate Board** — 汇率、加密行情与资产快照
- **Atlas Info** — 国家百科
- **Node Atlas** — 节点情报
- **Time & Leave** — 时间与假期：跨时区会议规划 / 假期与请假优化
- **Radio Atlas** — 全球电台
- **Food & Drinks** — 美食与调酒：食谱 / 鸡尾酒
- **HN Reader** — HN 阅读器
- **Dev Tools** — 开发者工具：Markdown 工作室、二维码工坊与密码保险箱
- **Meme Forge** — 梗图工坊

API 探针不再单独占首页卡片，从首页顶栏的 API 状态入口打开。各工具共享数据层与组件，也保留独立访问入口。支持深浅色模式与中英双语。

## 开发

```bash
npm install
npm run dev      # 本地开发（根路径 /）
npm run build    # 生产构建（base 为 /tools/）
npm run preview  # 预览生产构建
npm test         # 逻辑单测（node --test）+ 组件测试（Vitest + jsdom）
npm run lint     # ESLint（flat config）
npm run format   # Prettier 格式化
```

Node 20.19+ 或 22.13+（见 `package.json` 的 `engines`）。

### 目录约定

- `src/views/` — 路由页面，一个应用一个文件
- `src/views/space/` — Space Now 融合应用：外壳、概览与各标签面板；非概览标签按需异步加载（Leaflet 只在地图标签下载）
- `src/copy/` — 各页面的中英文案表，视图里 `import copy from '../copy/<name>.js'` 后交给 `useT(copy)`
- `src/lib/` — 无框架依赖的纯逻辑，便于直接单测（`tests/` 里的用例只依赖这一层）
- `src/components/ui/` — 本地 UI 组件库（页面外壳、按钮、表单、卡片、标签页、弹窗、加载/错误/空状态等），全部页面从这里取组件，统一出口为 `index.js`
- `src/components/` — 共享组件（`AppHeader` / `AppFooter`；`space/` 下是 Space Now 的专用卡片）
- `src/styles/shared.css` — 设计 token、基础重置、滚动条与组件库共用的 spinner 动效
- `src/styles/space.css` — Space Now 卡片内容的通用排版（仍作用在 `.space-now` 下）
- `tests/` — 纯逻辑单测（Node test runner）
- `ui-tests/` — Vue 组件测试（Vitest + @vue/test-utils）

融合应用（Space Now / Repo Lens / Food & Drinks / Time & Leave）把多个子页面作为标签展示，
子页面自身不再带全屏外壳：外壳只由融合页面提供，子页面只负责内容区。

## 测试与 CI

`.github/workflows/deploy.yml` 先跑 `npm test`，通过后才构建并部署到 `gh-pages`；
PR 只跑测试，不部署。`githubAPI` 的限流 / 404 / 202 分支有专门用例覆盖 —— 这段逻辑历史上回归过两次。
