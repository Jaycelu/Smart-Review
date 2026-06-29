# Smart Review Plugin

Smart Review 插件本体负责完整复习闭环：扫描 Properties / YAML frontmatter、打开 Smart Review Center、写回复习反馈、暂停与恢复、追加历史，并可选调用用户配置的模型完成掌握检验。

UI 支持 English / 简体中文，默认跟随 Obsidian 应用语言，也可以在插件设置中手动切换。样式使用 Obsidian 官方主题变量，适配浅色和深色模式。

## 动态复习间隔

插件保留基于当前间隔和 `review_ease` 的动态算法，并允许在设置页调整：

- `Again` 重置天数，默认 `1`
- `Hard` 间隔倍率，默认 `1.2`
- `Good` ease 附加倍率，默认 `1.0`
- `Easy` ease 附加倍率，默认 `1.3`

Review Center 的评分按钮会显示每篇笔记当前计算出的实际间隔。点击评分后，写入 `next_review` 的结果与按钮预览使用同一个共享计算函数。

## 暂停与 AI 掌握检验

- 暂停笔记保留在 Review Center 的独立折叠区，可直接恢复。
- 同一篇文章的每次掌握检验都追加到同一个 Markdown 成长记录。
- AI 检验显示参考答案、原文证据、缺失点和高/中/低置信度。
- 支持 OpenAI-compatible、OpenAI、Anthropic、Gemini、Azure OpenAI 和 Ollama。
- API Key 保存在 Vault 内的插件 `data.json`，Obsidian 不会加密该文件；同步 Obsidian 配置时它也可能被同步。
- 只有用户主动发起检验时，当前文章和回答才会发送到所选服务商；不包含其他笔记或客户端遥测。

## 构建

```bash
cd smart-review
pnpm install
pnpm --filter @smart-review/obsidian-plugin build
```

构建产物：

```text
apps/smart-review-plugin/main.js
```

## 安装到 Obsidian

复制以下文件到你的 Vault：

```text
<Vault>/.obsidian/plugins/smart-review/manifest.json
<Vault>/.obsidian/plugins/smart-review/main.js
<Vault>/.obsidian/plugins/smart-review/styles.css
```

启用插件后，点击 Ribbon 图标打开 Smart Review Center。`Generate Review Widget Data` 命令用于手动覆盖更新 `review-index.json`。

## 文件策略

- `review-index.json`：覆盖写入的当前索引快照。
- `review-history.jsonl`：追加写入的复习动作事件日志。
- `review-ai-cards.json`：覆盖写入的当前 AI 复习卡片 Payload。
- `00-总览/今日复习.md`：覆盖写入的 Obsidian 原生今日复习中心。
