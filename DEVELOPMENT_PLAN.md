# StarVista 开发计划

Date: 2026-06-13
配套文档：[README.md](README.md)（项目简报）

本文档是 StarVista 的执行计划，面向 AI 编码代理（Codex）逐阶段开发。每个阶段都有明确的任务清单和验收标准，**完成并验证当前阶段后再进入下一阶段**。

---

## 0. 已拍板的决策（不再讨论）

| 决策点         | 结论                                                | 理由                      |
| -------------- | --------------------------------------------------- | ------------------------- |
| 数据来源       | 仅 GitHub 官方 REST API（Octokit），不爬 Trending   | 合规、稳定                |
| 仓库范围       | 仅公开仓库                                          | MVP 简化                  |
| UI 语言        | 英文优先，预留 i18n 结构                            | 面向全球开发者            |
| 数据存储       | 独立 orphan 分支 `data`，不进主分支                 | 避免 git 历史膨胀         |
| LLM            | 默认不用；摘要用模板生成                            | 零运行成本                |
| 框架           | Astro + TypeScript（strict），交互岛用 React        | 内容型静态站首选          |
| 包管理         | npm（仓库根有 package-lock.json）                   | Actions 零配置            |
| Node 版本      | 22 LTS                                              |                           |
| 图表           | Observable Plot（轻量优先），不引入 ECharts/D3 全量 | 体积控制                  |
| 托管           | GitHub Pages，base path `/StarVista/`               | 零成本                    |
| 首批规模       | 每日 100 个仓库                                     | rate limit 预算内         |
| 增长引擎优先级 | 可嵌入 SVG 卡片提前到 Phase 3（早于趋势视图）       | README 嵌入是主要传播渠道 |
| 详情页结构图   | 降级为可选项，优先 star sparkline + release 时间线  | 信息量/成本比更高         |

## 1. 与 README 简报的差异

本计划在简报基础上做了三处调整，开发时以本文档为准：

1. **快照从 Phase 1 第一天开始积累**（即使前端还没用上）。趋势指标需要至少 7 天历史数据，提前积累可消除上线时"rising 为空"的冷启动问题。
2. **可嵌入 SVG 卡片从原 Phase 4 提前到 Phase 3**，早于趋势视图。它和 OG 社交图共享渲染逻辑，且是被动增长渠道。
3. **仓库结构图（StructureMap）从 MVP 中移除**，挪到 Phase 6 可选项。

## 2. 活跃度信号定义（实现前必读）

分类函数 `classifyActivity(repo, snapshots)` 按以下**优先级顺序**返回第一个命中的标签：

```text
1. archived     — repo.archived === true
2. fast-rising  — 需要 ≥7 天快照数据；近 7 日 star 增量 ≥ max(300, 当前 stars × 3%)
                  （快照不足 7 天时跳过此规则，不报错）
3. active       — pushedAt 距今 ≤ 14 天
4. stable       — pushedAt 距今 ≤ 90 天
5. cooling      — 其余情况
```

- 阈值定义为常量集中放在 `src/lib/activity.ts`，禁止散落在组件里。
- 此函数必须是纯函数，必须有单元测试覆盖全部 5 个分支和"快照不足"边界。

## 3. 数据模型

所有 JSON 由 pipeline 生成，前端只读。字段命名 camelCase。

### 3.1 `manifest.json`（首页数据，单文件）

```jsonc
{
  "generatedAt": "2026-06-13T02:00:00Z",
  "repoCount": 100,
  "repos": [
    {
      "id": "vercel/next.js", // owner/name，唯一键
      "slug": "vercel-next.js", // 文件名与 URL 用，/ 替换为 -
      "owner": "vercel",
      "name": "next.js",
      "description": "The React Framework",
      "archived": false,
      "primaryLanguage": "TypeScript",
      "languageColor": "#3178c6",
      "stars": 128000,
      "forks": 27000,
      "openIssues": 2900,
      "pushedAt": "2026-06-12T18:00:00Z",
      "topics": ["react", "framework"],
      "license": "MIT", // 可为 null
      "activity": "active", // 见第 2 节
      "starDelta7d": 1200, // 快照不足 7 天时为 null
      "ownerAvatarUrl": "https://...",
    },
  ],
}
```

### 3.2 `repos/<slug>.json`（详情页数据，每仓库一个文件）

在 manifest 条目基础上追加：

```jsonc
{
  // ...manifest 中的全部字段，外加：
  "languages": { "TypeScript": 0.62, "JavaScript": 0.25, "Rust": 0.13 }, // 占比，保留两位
  "readmeExcerpt": "...", // README 首段纯文本，≤500 字符，剥离 HTML/badge
  "summary": {
    "mode": "template", // "template" | "llm"
    "text": "next.js is a TypeScript project focused on ...",
    "readmeHash": "sha256:...", // 仅 llm 摘要使用；README 内容不变时复用
  },
  "releases": [
    // 最近 5 个
    { "tag": "v15.2.0", "name": "...", "publishedAt": "2026-06-01T00:00:00Z" },
  ],
  "starHistory": [
    // 由快照聚合，最多 90 个点
    { "date": "2026-06-13", "stars": 128000 },
  ],
  "links": {
    "repo": "https://github.com/vercel/next.js",
    "homepage": "https://nextjs.org", // 可为 null
  },
}
```

### 3.3 `snapshots/<YYYY-MM-DD>.json`（每日快照，只追加）

```jsonc
{
  "date": "2026-06-13",
  "repos": {
    "vercel/next.js": { "stars": 128000, "forks": 27000, "openIssues": 2900 },
  },
}
```

快照保持紧凑（仅数值字段），90 天后可按周降采样归档（Phase 4 实现，先不做）。

## 4. 仓库结构

```text
StarVista/
  README.md
  DEVELOPMENT_PLAN.md
  package.json
  astro.config.mjs            # base: '/StarVista/'，site 配置，sitemap 集成
  tsconfig.json               # strict
  src/
    pages/
      index.astro             # 首页：卡片网格 + 筛选
      repos/[slug].astro      # 详情页，getStaticPaths 遍历 manifest
      embed/[slug].svg.ts     # Phase 3：SVG 卡片端点
    components/
      RepoCard.astro
      RepoGrid.astro
      FilterBar.tsx           # React 岛：语言/topic 筛选
      Sparkline.astro         # 纯 SVG，无运行时依赖
      ReleaseTimeline.astro
    lib/
      activity.ts             # 活跃度分类（纯函数）
      types.ts                # 数据模型 TS 类型（与第 3 节一一对应）
      data.ts                 # 读取 public/data 的辅助函数
    styles/
      global.css
  scripts/
    fetch-repos.ts            # 搜索 + 拉详情 + 归一化
    write-snapshot.ts         # 写当日快照
    build-data.ts             # 聚合快照 → starHistory/starDelta7d/activity
    generate-embeds.ts        # Phase 3：批量生成 SVG 卡片与 OG 图
    lib/                      # 脚本共享逻辑（github client、normalize、template summary）
  tests/
    activity.test.ts
    normalize.test.ts
  fixtures/
    sample-manifest.json      # 前端开发用假数据，避免消耗 API
    sample-repo.json
  public/
    data/                     # 构建时从 data 分支同步，gitignore（主分支）
  .github/
    workflows/
      update-data.yml         # 每日 cron：拉数据 → 提交到 data 分支
      deploy.yml              # data 分支更新或主分支 push 后：构建 + 部署 Pages
```

## 5. 数据分支策略

- `data` 为 orphan 分支，只存 `manifest.json`、`repos/`、`snapshots/`。
- `update-data.yml`（cron: 每日 02:00 UTC）：checkout `data` 分支 → 运行 `fetch-repos.ts` + `write-snapshot.ts` + `build-data.ts` → commit & push 到 `data` 分支 → 触发 `deploy.yml`（`workflow_run` 或 repository_dispatch）。
- `deploy.yml`：checkout 主分支 + checkout `data` 分支到 `public/data/`（`actions/checkout` 的 `path` 参数）→ `npm run build` → 部署 Pages（`actions/deploy-pages`）。
- 本地开发不依赖 data 分支：`npm run dev` 时若 `public/data` 为空，自动 fallback 到 `fixtures/`。

## 6. API 预算

GITHUB_TOKEN 在 Actions 中限额 1,000 请求/小时（search 另算：30 次/分钟）。每日单次运行预算：

```text
search 仓库列表:        ~4 次（分页）
每仓库详情:             README(1) + languages(1) + releases(1) = 3 次
                        topics/license/owner 已包含在 search 结果中，不另发请求
100 仓库合计:           ~304 次/天  →  限额内余量充足
```

约束：

- 详情仅对**新发现或 pushedAt 变化**的仓库重新拉取，其余复用 data 分支上的旧 JSON。
- 收到 403/429 时指数退避并尊重 `x-ratelimit-reset`，重试 3 次后跳过该仓库（记录 warning，不让整个 run 失败）。
- 单个仓库数据异常（如无 README）不得中断 pipeline，写入字段为 null 并继续。

---

## 7. 分阶段任务

### Phase 0 — 脚手架（半天量级）

任务：

1. `git init`，关联 `MightyKartz/StarVista` 远程。
2. Astro + TypeScript strict 脚手架，React 集成，`@astrojs/sitemap`。
3. `astro.config.mjs` 配置 `site` 与 `base: '/StarVista/'`。
4. Vitest 配置；ESLint + Prettier（默认规则即可，不过度配置）。
5. `src/lib/types.ts` 按第 3 节定义全部数据类型。
6. `fixtures/` 放 2~3 条手写假数据。
7. `deploy.yml` 骨架：push 主分支即构建部署（此时用 fixtures 构建）。

验收标准：

- [ ] `npm run dev` / `npm run build` / `npm test` 全部可运行。
- [ ] Pages 上能访问到一个用 fixtures 渲染的占位首页（注意 base path 下资源路径正确）。

### Phase 1 — 数据管道与每日快照（核心，优先级最高）

任务：

1. `scripts/lib/github.ts`：Octokit 封装，带退避重试。
2. `fetch-repos.ts`：search API 取 top 100（按 stars，限定近 30 天有 push），归一化为 manifest 条目；对新/变化仓库拉详情生成 `repos/<slug>.json`。
3. `write-snapshot.ts`：写 `snapshots/<date>.json`；同日重跑覆盖而非追加。
4. `build-data.ts`：聚合快照计算 `starDelta7d`、`starHistory`、`activity`（调用 `src/lib/activity.ts`，脚本与前端共用同一实现）。
5. 模板摘要生成（README §12 的模板），写入 `summary` 字段。
6. `update-data.yml`：每日 cron，提交到 `data` 分支，完成后触发 deploy。
7. 单元测试：activity 分类全分支、归一化函数（fixture 输入 → 期望输出）。

验收标准：

- [ ] 本地 `GITHUB_TOKEN=xxx npm run fetch` 能生成完整合法的 manifest + 100 个详情 JSON + 当日快照。
- [ ] 连续两天的 Actions 运行成功，data 分支有两个快照文件。
- [ ] 任意单仓库数据异常不会导致 run 失败。
- [ ] `npm test` 通过。

> 本阶段完成后立即让 cron 每日运行，开始积累快照。后续阶段开发期间数据持续增长。

### Phase 2 — 静态站点 MVP

任务：

1. 首页：RepoGrid + RepoCard，卡片含 README §7 列出的字段（结构图除外），语言色条、activity 徽章。
2. FilterBar（React 岛）：按语言、topic、activity 筛选 + 按 stars/最近更新排序。纯客户端过滤，数据已在页面内。
3. 详情页 `repos/[slug]`：hero 摘要、languages 占比条、release 时间线、README 摘录、外链。starHistory 不足 7 天时 sparkline 区域显示"collecting data"。
4. SEO：每页独立 title/description/canonical/OG meta，sitemap，语义化 HTML。
5. 视觉方向遵循 README §16：首屏直接是仓库卡片，无营销页。

验收标准：

- [ ] Pages 上线，展示 ≥100 个真实仓库（README §19 标准）。
- [ ] 筛选与排序可用，无 JS 时页面内容仍可读（筛选可降级失效）。
- [ ] Lighthouse（移动端）Performance ≥ 90，SEO ≥ 95。
- [ ] 每个详情页有唯一的 meta 信息。

### Phase 3 — 可嵌入资产（增长引擎，提前于趋势视图）

任务：

1. `src/pages/embed/[slug].svg.ts`：构建时为每个仓库生成自包含 SVG 卡片（手写 SVG 模板，system font stack，不嵌字体），深浅双主题（`-dark` 后缀）。
2. OG 分享图：复用同一模板渲染 1200×630（satori + resvg 转 PNG），挂到详情页 og:image。
3. 详情页加 "Embed this card" 区块，提供可复制的 Markdown 片段。
4. 站点 README 顶部放自己的嵌入卡片示例（吃自己的狗粮）。

验收标准：

- [ ] 任意仓库的 SVG 卡片 URL 在 GitHub README 中实测渲染正常（经 camo 代理）。
- [ ] 单个 SVG ≤ 30KB。
- [ ] 详情页分享到社交平台显示正确 OG 图。

### Phase 4 — 趋势视图（此时已有数周快照）

任务：

1. Sparkline 组件接入真实 starHistory。
2. 首页新增 "Rising" 与 "New today" 标签页/视图（基于 starDelta7d 与快照首次出现日期）。
3. 快照降采样：>90 天的快照按周归档，控制 data 分支体积。
4. 周报视图（可选）："fastest growing this week" 列表。

验收标准：

- [ ] Rising 列表与 fast-rising 徽章数据一致。
- [ ] 90 天以上历史正确降采样且 sparkline 不失真。

### Phase 5 — 可选 AI 摘要

任务：

1. `summary.mode === "llm"` 路径：Actions 中离线调用（用户提供 API key 的 secret，缺省跳过）。
2. 按 README 内容 hash 缓存，hash 不变不重新生成。
3. 前端展示时标注 AI 生成。

验收标准：

- [ ] 无 API key 时 pipeline 行为与 Phase 1 完全一致（默认关闭）。
- [ ] 重复运行不产生重复 LLM 调用。

### Phase 6 — 探索项（无承诺）

- 更丰富的时间线视图、动画 star 卡片、分类专属模板。
- 仓库结构图（从 MVP 移出的项，仅在用户反馈需要时做）。
- 短视频生成（README §17 Phase 6，明确排最后）。

---

## 8. 给编码代理的工作约定

1. **按阶段推进**：每个 Phase 的验收标准全部勾选后再开始下一阶段。一个 Phase 内可自由拆分 commit。
2. **数据模型即契约**：第 3 节的 JSON 结构改动必须同步更新 `types.ts`、fixtures 和本文件。
3. **前端开发用 fixtures**，不要在开发循环里调 GitHub API。
4. **脚本与前端共享逻辑放 `src/lib/`**（如 activity.ts），scripts 引用它，不要复制两份。
5. **不引入本计划未列出的运行时依赖**；构建期依赖（satori 等）可按需添加但需在 commit message 说明。
6. **base path 是高频坑**：所有内部链接、资源引用、SVG URL 都必须经过 Astro 的 base 处理，每次部署后实测 Pages 上的链接。
7. 纯逻辑（分类、归一化、降采样）必须有 Vitest 测试；UI 不强制测试。
8. Actions 中所有 secrets 通过环境变量读取，代码中不出现任何 token 字面量。
9. commit message 用英文，常规式（`feat:`/`fix:`/`chore:`）。

## 9. 风险与对策备忘

| 风险                                        | 对策                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| 趋势数据冷启动                              | Phase 1 完成即开跑 cron，Phase 4 开发时已有数据                              |
| data 分支膨胀                               | 快照仅数值字段 + 90 天降采样；必要时迁独立数据仓库                           |
| 与 Trending/Trendshift 同质化               | 差异点押注在嵌入卡片（Phase 3）与详情页 SEO，不在首页列表                    |
| GitHub API 配额                             | 见第 6 节；增量拉取 + 退避                                                   |
| Pages base path 路径错误                    | Phase 0 即配置并在验收中实测                                                 |
| search API 结果抖动（同 star 数排序不稳定） | manifest 按 id 去重合并历史名单，仓库只进不出（被 archive 的打标签而非删除） |
