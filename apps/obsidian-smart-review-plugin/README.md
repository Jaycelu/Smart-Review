# Obsidian Smart Review Plugin

Obsidian 插件本体负责完整复习闭环：扫描 Properties / YAML frontmatter、打开 Review Center、显示状态栏计数、写回复习反馈、追加历史、生成 Markdown 复习中心和 AI 复习卡片 Payload。

## 构建

```bash
cd obsidian-smart-review
pnpm install
pnpm --filter @obsidian-smart-review/obsidian-plugin build
```

构建产物：

```text
apps/obsidian-smart-review-plugin/main.js
```

## 安装到 Obsidian

复制以下文件到你的 Vault：

```text
<Vault>/.obsidian/plugins/obsidian-smart-review/manifest.json
<Vault>/.obsidian/plugins/obsidian-smart-review/main.js
<Vault>/.obsidian/plugins/obsidian-smart-review/styles.css
```

启用插件后，点击 Ribbon 图标打开 Review Center。`Generate Smart Review Index` 命令仍保留，用于手动覆盖更新 `review-index.json`。

## 文件策略

- `review-index.json`：覆盖写入的当前索引快照。
- `review-history.jsonl`：追加写入的复习动作事件日志。
- `review-ai-cards.json`：覆盖写入的当前 AI 复习卡片 Payload。
- `00-总览/今日复习.md`：覆盖写入的 Obsidian 原生今日复习中心。
