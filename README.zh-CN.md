# Obsidian Smart Review

[English](README.md) | [插件源码](apps/obsidian-smart-review-plugin)

基于 Obsidian Properties / YAML frontmatter 的智能复习系统，让笔记按照 `next_review` 自动进入复习队列，并支持复习完成、间隔重复、复习历史和 AI 复习卡片。

当前主线是 Obsidian 插件本体独立可用。用户安装插件后，不需要额外安装 Mac App，也能在 Obsidian 内完成复习闭环。

## 核心能力

- 直接读取 Obsidian 笔记 Properties / YAML frontmatter
- 根据 `next_review` 自动生成复习队列
- 在插件内提供 Review Center 复习中心
- 状态栏显示今日复习和逾期数量，点击可打开 Review Center
- 支持 `again` / `hard` / `good` / `easy` 复习反馈
- 自动写回下一次复习日期、复习评分、间隔、ease 和 lapses
- 自动追加复习历史
- 生成 Obsidian 原生今日复习 Markdown
- 生成 AI 复习卡片 `prompt_payload`，不直接调用外部 AI API

## 项目结构

- `apps/obsidian-smart-review-plugin`: Obsidian Smart Review 插件，负责扫描、Review Center、状态栏、复习反馈、Markdown 导出和 AI Payload。
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
cd obsidian-smart-review
pnpm install
pnpm build
```

构建完成后，Obsidian 插件入口会生成在：

```text
apps/obsidian-smart-review-plugin/main.js
```

推荐使用安装脚本：

```bash
./scripts/install-obsidian-smart-review-plugin.sh "/path/to/your/vault"
```

iCloud 中的 Obsidian Vault 通常位于类似路径：

```bash
./scripts/install-obsidian-smart-review-plugin.sh "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/<你的Vault名>"
```

脚本会执行构建，并复制以下文件到 `<Vault>/.obsidian/plugins/obsidian-smart-review/`：

```text
apps/obsidian-smart-review-plugin/manifest.json
apps/obsidian-smart-review-plugin/main.js
apps/obsidian-smart-review-plugin/styles.css
```

## Obsidian 内使用

启用插件后：

1. 点击左侧 Ribbon 图标打开 Review Center。
2. 在 Review Center 查看已逾期、今日复习、未来 7 天、更远未来和日期无效任务。
3. 点击任务标题打开对应笔记。
4. 点击 `Again` / `Hard` / `Good` / `Easy` 完成复习反馈。
5. 使用操作区按钮刷新数据、重新生成 `review-index.json`、生成今日复习 Markdown、生成 AI 卡片 Payload 或打开插件设置。

Command Palette 至少包含：

```text
Open Review Center
Generate Smart Review Index
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
pnpm test
```

## 发布文件

GitHub Release 需要上传：

```text
main.js
manifest.json
styles.css
```

Release tag 必须和 `manifest.json` 中的 `version` 完全一致，例如 `0.1.0`。
