# Release Notes

当前项目已经具备本地安装和 GitHub Release 分发的基础条件。Obsidian 社区插件升级依赖 GitHub Release：tag 必须和 `manifest.json` 的 `version` 完全一致，Release assets 必须包含 `main.js`、`manifest.json` 和 `styles.css`。

## Obsidian 插件安装

构建并安装到真实 Vault：

```bash
./scripts/install-smart-review-plugin.sh "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/数字卢语"
```

脚本会复制：

```text
apps/smart-review-plugin/main.js
apps/smart-review-plugin/manifest.json
apps/smart-review-plugin/styles.css
```

目标目录：

```text
<Vault>/.obsidian/plugins/smart-review/
```

安装后需要在 Obsidian 社区插件中启用 `Smart Review`。

## 发布流程

1. 更新根目录 `manifest.json` 中的 `version`，保持 SemVer 格式。
2. 如果新版本需要更高 Obsidian 版本，同时更新根目录 `manifest.json` 中的 `minAppVersion`。
3. 运行发布准备命令：

```bash
pnpm run release:plugin
```

该命令会：

- 同步根目录和插件目录的 `manifest.json`
- 同步根目录、插件包和 shared 包的 `package.json` 版本
- 写入根目录和插件目录的 `versions.json`
- 构建插件
- 复制 Release assets 到 `dist/plugin/`

4. 创建 GitHub Release，tag 必须等于 `manifest.json.version`，不要加 `v` 前缀。
5. 上传以下文件：

```text
dist/plugin/main.js
dist/plugin/manifest.json
dist/plugin/styles.css
```

也可以直接推送无 `v` 前缀的 SemVer tag，例如：

```bash
git tag 0.1.1
git push origin 0.1.1
```

`.github/workflows/release-plugin.yml` 会自动安装依赖、检查 tag 与 `manifest.json.version` 是否一致、构建 `dist/plugin/`，并创建 GitHub Release。

工作流还会为 `main.js`、`manifest.json` 和 `styles.css` 生成 GitHub artifact attestations，供 Obsidian 社区自动审核验证 Release assets 的来源。

## versions.json 策略

`versions.json` 只在 `minAppVersion` 变化时才对旧版 Obsidian 有实际意义。当前脚本会为每次发布写入版本映射，这样更直观，也不会破坏 Obsidian 的兼容判断。若未来提高 `minAppVersion`，旧版 Obsidian 会根据 `versions.json` 回退到它能安装的最新兼容插件版本。

## 当前发布能力

已完成：

- Obsidian 插件本地安装脚本
- Release assets 准备脚本
- manifest / package / versions 同步脚本
- GitHub Actions 自动发版
- Release assets GitHub artifact attestations
- tag、manifest 版本一致性校验

Obsidian Community 目录的版本审核由社区后台触发，仓库不绕过或替代该审核流程。发布前应确保默认分支已包含准确的根目录 `manifest.json`，再推送与版本完全一致、且不带 `v` 前缀的 tag。
