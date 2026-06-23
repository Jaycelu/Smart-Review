# Smart Review

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

[Plugin source](apps/smart-review-plugin)

Smart Review is a review center for Obsidian notes that uses Properties / YAML frontmatter. It builds review queues from `next_review`, lets you complete reviews inside Obsidian, writes spaced-review metadata back to notes, records review history, and exports AI review-card prompt payloads.

The Obsidian plugin works on its own and does not require any external companion app.

## Language and Theme

- UI language supports English and Simplified Chinese.
- The default language mode is `Auto`, which follows Obsidian's app language.
- You can override the language in `Settings -> Smart Review -> Language`.
- The UI uses Obsidian theme variables for light and dark mode compatibility, including cards, heatmaps, drill-down panels, progress bars, and status bar text.

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

## Smart Review Center

The built-in Smart Review Center is the plugin's single main page. It does not require any companion Mac app and does not split analytics into a second dashboard view.

It includes:

- Today's review plan with overdue, today, and next 7 days groups.
- Direct note opening from each review task.
- `Again`, `Hard`, `Good`, and `Easy` feedback buttons.
- Overview cards for today, overdue, completed this week, and vault health score.
- Task Flow completion progress.
- Review activity heatmap based on `review-history.jsonl`.
- Vault creation heatmap based on `frontmatter.created`, file creation time, or file modified time.
- Domain, tag, and review rating distributions.
- Clickable distribution rows with in-page drill-down details and collapsible long lists.

The health score is a lightweight operational indicator. It combines review coverage, overdue control, recent activity, metadata completeness, and AI card readiness. It is not an absolute measure of knowledge quality.

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

- `Open Smart Review Center`
- `Generate Review Widget Data`
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

For an Obsidian community release, create a GitHub release whose tag exactly matches the version in `manifest.json`, for example `0.2.0`.

Prepare release assets:

```bash
pnpm run release:plugin
```

Upload these files from `dist/plugin/` as release assets:

- `main.js`
- `manifest.json`
- `styles.css`

The release tag should not use a `v` prefix.

Before bumping a release, update the root `manifest.json` version. Then run `pnpm run sync:plugin-release` to keep the plugin manifest, package versions, and both `versions.json` files aligned.

Pushing a tag such as `0.2.0` runs the release workflow automatically. The workflow fails if the tag does not match `manifest.json.version`.

## Updating the Installed Plugin

After a GitHub release is published, users can update from Obsidian's Community plugins page. For manual testing before community catalog publication, download `main.js`, `manifest.json`, and `styles.css` from the GitHub release and copy them into:

```text
<Vault>/.obsidian/plugins/smart-review/
```

Then reload Obsidian or disable and re-enable Smart Review.
