# Smart Review

语言 / Languages：[English](README.md) | [简体中文](README.zh-CN.md)

[插件源码](apps/smart-review-plugin)

基于 Obsidian Properties / YAML frontmatter 的智能复习系统，让笔记按照 `next_review` 自动进入复习队列，并支持复习完成、间隔重复、复习历史和 AI 复习卡片。

当前主线是 Obsidian 插件本体独立可用。用户安装插件后，不需要额外安装 Mac App，也能在 Obsidian 内完成复习闭环。

## 语言与主题

- UI 支持 English 和简体中文。
- 默认语言为 `自动`，跟随 Obsidian 应用语言。
- 可以在 `Settings -> Smart Review -> 语言` 中手动切换。
- UI 使用 Obsidian 官方主题变量，适配浅色和深色模式，包括卡片、热力图、下钻详情、进度条和状态栏。

## 核心能力

- 直接读取 Obsidian 笔记 Properties / YAML frontmatter
- 根据 `next_review` 自动生成复习队列
- 在插件内提供融合式 Smart Review Center
- 状态栏显示今日复习和逾期数量，点击可打开 Smart Review Center
- 支持 `again` / `hard` / `good` / `easy` 复习反馈
- 保留动态间隔重复算法，同时允许用户调整四档复习规则
- 在评分按钮上预览每篇笔记本次计算出的实际间隔
- 自动写回下一次复习日期、复习评分、间隔、ease 和 lapses
- 自动追加复习历史
- 生成 Obsidian 原生今日复习 Markdown
- 生成 AI 复习卡片 `prompt_payload`，不直接调用外部 AI API

## Smart Review Center

Smart Review Center 是插件内置的单一主页面，不需要额外安装 Mac App，也不会拆成第二个独立 Dashboard。

页面包含：

- 今日复习计划：按已逾期、今日复习、未来 7 天分组。
- 任务跳转：点击标题直接打开对应 Obsidian 笔记。
- 复习反馈：每条任务支持 `Again` / `Hard` / `Good` / `Easy`。
- 间隔预览：按钮直接显示 `Again · 1天`、`Hard · 36天`、`Good · 75天`、`Easy · 98天` 等当前计算结果。
- 数据总览：今日复习、逾期任务、本周完成和知识库健康分。
- Task Flow：今日完成率进度条。
- 复习活跃热力图：基于 `review-history.jsonl`。
- 笔记创建热力图：基于 `frontmatter.created`、文件创建时间或文件修改时间。
- 领域、标签和复习评分分布。
- 分布行可点击查看详情，长列表默认折叠，避免页面杂乱。

健康分是辅助运营指标，综合复习覆盖率、逾期控制、最近复习活跃度、元数据完整度和 AI 卡片准备度；它不代表知识质量的绝对水平。

## 动态复习间隔设置

在 `设置 -> Smart Review` 中可以调整动态算法参数：

- **初始复习间隔天数**：没有复习历史时使用的基础间隔，默认 `30`。
- **Again 间隔天数**：遗忘后重置到的间隔，默认 `1`。
- **Hard 间隔倍率**：乘以上一次复习间隔，默认 `1.2`。
- **Good 间隔倍率**：在笔记 ease 系数之外追加的倍率，默认 `1.0`。
- **Easy 间隔倍率**：在笔记 ease 系数之外追加的倍率，默认 `1.3`。

升级后的默认行为与 0.2.2 完全一致，不会改变已有笔记的 frontmatter 结构。评分按钮会结合当前笔记的 `review_interval_days`、`review_ease` 和上述设置，显示本次点击后实际采用的间隔。

## 0.2.3 更新内容

- 新增四档动态复习间隔规则配置。
- 评分按钮新增每篇笔记的实际间隔预览。
- 保持 0.2.2 默认算法和已有 frontmatter 兼容。

## 项目结构

- `apps/smart-review-plugin`: Smart Review 插件，负责扫描、Smart Review Center、状态栏、复习反馈、Markdown 导出和 AI Payload。
- `packages/shared`: 复用类型、日期解析和复习状态计算逻辑。
- `manifest.json` / `versions.json`: 放在仓库根目录，供 Obsidian 社区插件提交读取。

## 文件写入策略

这些文件不会无限堆积生成副本：

- `review-index.json` = 当前最新复习索引，覆盖写入。
- `review-history.jsonl` = 复习动作历史记录，追加写入。
- `review-ai-cards.json` = 当前 AI 复习卡片 Payload，覆盖写入。
- `00-总览/今日复习.md` = Obsidian 原生今日复习中心，覆盖写入。

插件默认用 Obsidian `vault.adapter.write(path, content)` 写入快照类文件，因此同一路径每次都是覆盖更新。用户可以在设置中修改路径，但同一个路径仍保持相同策略：索引、AI Payload、今日复习 Markdown 覆盖写入；历史 JSONL 只追加复习事件。

## 安装与构建

```bash
cd smart-review
pnpm install
pnpm build
```

构建完成后，Obsidian 插件入口会生成在：

```text
apps/smart-review-plugin/main.js
```

推荐使用安装脚本：

```bash
./scripts/install-smart-review-plugin.sh "/path/to/your/vault"
```

iCloud 中的 Obsidian Vault 通常位于类似路径：

```bash
./scripts/install-smart-review-plugin.sh "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/<你的Vault名>"
```

脚本会执行构建，并复制以下文件到 `<Vault>/.obsidian/plugins/smart-review/`：

```text
apps/smart-review-plugin/manifest.json
apps/smart-review-plugin/main.js
apps/smart-review-plugin/styles.css
```

## Obsidian 内使用

启用插件后：

1. 点击左侧 Ribbon 图标打开 Smart Review Center。
2. 在 Smart Review Center 查看今日复习计划、数据总览、热力图和分布分析。
3. 点击任务标题打开对应笔记。
4. 点击 `Again` / `Hard` / `Good` / `Easy` 完成复习反馈。
5. 使用顶部按钮刷新数据、生成今日复习 Markdown、生成 AI 卡片 Payload 或打开插件设置。

Command Palette 至少包含：

```text
Open Smart Review Center
Generate Review Widget Data
Refresh Review Data
Mark Current Note Reviewed
Generate Daily Review Markdown
Generate AI Review Cards Payload
```

`Mark Current Note Reviewed` 默认按设置中的默认评分处理，初始值为 `good`。

## 写回字段

复习反馈会写回当前笔记 frontmatter：

```yaml
last_reviewed: 2026-05-28
next_review: 2026-06-05
review_count: 1
review_rating: good
review_interval_days: 7
review_ease: 2.5
review_lapses: 0
```

间隔重复算法保持轻量、可解释：

- `again`: 短间隔，表示没有掌握
- `hard`: 较短间隔
- `good`: 正常间隔
- `easy`: 更长间隔

## AI 复习卡片 Payload

当前阶段只生成 `review-ai-cards.json`，模式为 `prompt_payload`。插件会从今日和逾期任务读取笔记正文并生成 prompt，供用户复制到 ChatGPT / Dify / Ollama / 本地 AI 服务。

本阶段不会增加 OpenAI API Key、Ollama、Dify、FastAPI AI Service 或任何远程网络请求。

## 本地开发

```bash
pnpm dev
pnpm typecheck
pnpm lint
```

## 发布文件

发布前先更新根目录 `manifest.json` 里的 `version`，然后执行：

```bash
pnpm run release:plugin
```

该命令会同步插件 manifest、根目录 manifest、各 package 版本和 `versions.json`，构建插件，并把可上传的 Release 文件复制到：

```text
dist/plugin/
```

GitHub Release 需要上传：

```text
main.js
manifest.json
styles.css
```

Release tag 必须和 `manifest.json` 中的 `version` 完全一致，例如 `0.2.3`。不要加 `v` 前缀。

推送 `0.2.3` 这类 tag 会自动触发 GitHub Actions 发版；如果 tag 和 `manifest.json.version` 不一致，workflow 会直接失败。

## 用户如何更新插件

发布 GitHub Release 后，用户可以在 Obsidian 的 Community plugins 页面更新。社区插件目录正式收录前，可以手动下载 Release assets：

```text
main.js
manifest.json
styles.css
```

复制到：

```text
<Vault>/.obsidian/plugins/smart-review/
```

然后重启 Obsidian，或禁用再启用 Smart Review。
