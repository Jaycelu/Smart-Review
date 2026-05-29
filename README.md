# Smart Review

[中文说明](README.zh-CN.md) | [Plugin source](apps/smart-review-plugin)

Smart Review is a review center for Obsidian notes that uses Properties / YAML frontmatter. It builds review queues from `next_review`, lets you complete reviews inside Obsidian, writes spaced-review metadata back to notes, records review history, and exports AI review-card prompt payloads.

The Obsidian plugin works on its own and does not require any external companion app.

## Features

- Read Obsidian Properties / YAML frontmatter directly.
- Build review queues from `next_review`.
- Show overdue, today, next 7 days, future, and invalid-date notes in Review Center.
- Display today and overdue counts in the Obsidian status bar.
- Support `again`, `hard`, `good`, and `easy` review feedback.
- Write review metadata back to note frontmatter.
- Append review events to `review-history.jsonl`.
- Generate a native Markdown daily review page.
- Generate `review-ai-cards.json` as a prompt payload without calling external AI APIs.

## Repository Structure

- `apps/smart-review-plugin`: Obsidian plugin source and build output.
- `packages/shared`: Shared types, date parsing, and review-state logic.
- `manifest.json` and `versions.json`: Root copies for Obsidian community submission.

## Local Development

```bash
pnpm install
pnpm build
```

Build output for manual Obsidian installation:

```text
apps/smart-review-plugin/main.js
apps/smart-review-plugin/manifest.json
apps/smart-review-plugin/styles.css
```

Install into a local vault:

```bash
./scripts/install-smart-review-plugin.sh "/path/to/your/vault"
```

The script copies the plugin files to:

```text
<Vault>/.obsidian/plugins/smart-review/
```

## Obsidian Commands

- `Open Review Center`
- `Generate Review Index`
- `Refresh Review Data`
- `Mark Current Note Reviewed`
- `Generate Daily Review Markdown`
- `Generate AI Review Cards Payload`

## Generated Files

- `review-index.json`: Current review index snapshot, overwritten on each generation.
- `review-history.jsonl`: Review event history, appended per review action.
- `review-ai-cards.json`: Current AI review-card prompt payload, overwritten on each generation.
- `00-总览/今日复习.md`: Native Markdown review page, overwritten on each generation.

## GitHub Release Assets

For an Obsidian community release, create a GitHub release whose tag exactly matches the version in `manifest.json`, for example `0.1.0`.

Upload these files as release assets:

- `main.js`
- `manifest.json`
- `styles.css`

The release tag should not use a `v` prefix.
