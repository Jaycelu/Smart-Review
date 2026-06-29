# Smart Review

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

[Plugin source](apps/smart-review-plugin)

Smart Review is a review center for Obsidian notes that uses Properties / YAML frontmatter. It builds review queues from `next_review`, supports adaptive feedback, lets users pause and resume notes, and optionally runs evidence-grounded AI mastery exams with user-configured models.

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
- Keep adaptive spaced-review scheduling while allowing users to tune the four rating rules.
- Preview each note's calculated interval directly on the rating buttons.
- Write review metadata back to note frontmatter.
- Append review events to `review-history.jsonl`.
- Generate a native Markdown daily review page.
- Generate `review-ai-cards.json` as a prompt payload without calling external AI APIs.
- Pause notes for 30 days, 90 days, a custom date, or indefinitely, then resume without editing frontmatter.
- Run optional AI mastery exams with independent verification, confidence levels, delayed rechecks, and reference answers.
- Connect OpenAI-compatible APIs, OpenAI, Anthropic, Gemini, Azure OpenAI, and Ollama using your own credentials.

## Smart Review Center

The built-in Smart Review Center is the plugin's single main page. It does not require any companion Mac app and does not split analytics into a second dashboard view.

It includes:

- Today's review plan with overdue, today, and next 7 days groups.
- Direct note opening from each review task.
- `Again`, `Hard`, `Good`, and `Easy` feedback buttons.
- Per-note interval previews such as `Again · 1d`, `Hard · 36d`, `Good · 75d`, and `Easy · 98d`.
- Overview cards for today, overdue, completed this week, and vault health score.
- Task Flow completion progress.
- Review activity heatmap based on `review-history.jsonl`.
- Vault creation heatmap based on `frontmatter.created`, file creation time, or file modified time.
- Domain, tag, and review rating distributions.
- Clickable distribution rows with in-page drill-down details and collapsible long lists.
- Collapsible paused, mastery-recheck, mastered, and suggested-mastery groups.
- Container-responsive task cards that remain usable in narrow leaves.

Clicking the Ribbon icon opens Review Center in a main workspace tab. If an older workspace still has Review Center in a side dock, the explicit open action migrates it to the main area. Manually docking it again remains supported by the container-responsive layout.

The health score is a lightweight operational indicator. It combines review coverage, overdue control, recent activity, metadata completeness, and AI card readiness. It is not an absolute measure of knowledge quality.

## Review Interval Rules

Open `Settings -> Smart Review` to tune the adaptive scheduling rules:

- **Initial review interval days**: base interval for notes without review history. Default: `30`.
- **Again interval days**: reset interval after a failed recall. Default: `1`.
- **Hard interval multiplier**: multiplier applied to the current interval. Default: `1.2`.
- **Good interval multiplier**: additional multiplier applied after the note's ease factor. Default: `1.0`.
- **Easy interval multiplier**: additional multiplier applied after the note's ease factor. Default: `1.3`.

Existing users keep the same scheduling behavior after upgrading. The buttons show the interval calculated from the selected rules and each note's current `review_interval_days` and `review_ease` values.

## Pause, Resume, and Mastery

Pausing is a scheduling decision and does not mark a note as mastered. Paused notes leave the active plan but remain in the collapsible **Paused** group with a direct **Resume review** action. Commands are also available for pausing and resuming the current note.

AI mastery exams are optional and require a configured model. They generate closed-book questions, grade answers against article-grounded criteria, show reference answers after submission, independently verify qualifying results, and require a delayed recheck before marking a note mastered. Confidence is derived from source-evidence coverage and agreement between the examiner and verifier, not from a model-provided percentage alone.

Every source article uses one longitudinal Markdown mastery record. Failed attempts, retries, and delayed rechecks append new `Attempt N` sections to the same file. The default folder is `Smart Review/Mastery Records`, and missing folders are created automatically. In settings, choosing a parent folder such as `00-Overview` stores records under `00-Overview/Smart Review/Mastery Records`.

## AI Provider Setup and Network Disclosure

AI mastery exams use bring-your-own-key connections. Supported connection types are OpenAI, OpenAI-compatible, Anthropic, Google Gemini, Azure OpenAI, and Ollama. OpenAI-compatible endpoints cover services such as OpenRouter, AIHubMix, DeepSeek, Groq, SiliconFlow, Together, LM Studio, and vLLM when they expose compatible chat APIs.

For OpenAI-compatible providers, enter either the base URL or a full chat endpoint. Examples:

- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- AIHubMix: `https://aihubmix.com/v1`
- Full endpoint form: `https://example.com/v1/chat/completions`

Model discovery is optional. Some gateways do not expose `/models`; in that case, manually enter the model name and use **Test** to verify the chat endpoint. OpenRouter may require optional custom headers such as `HTTP-Referer` and `X-OpenRouter-Title`.

- No Smart Review account or payment is required.
- Only the current source article, generated exam, and submitted answers are sent to the provider selected by the user.
- Other vault notes, the review index, and provider API keys are not included in exam requests.
- API keys and unfinished exam drafts are stored in the plugin's vault-local `data.json`; they may sync if the user syncs Obsidian configuration files.
- Obsidian does not encrypt community plugin `data.json`; use a local provider for sensitive material or protect access to the vault and device.
- The plugin does not include client-side telemetry or advertising.

Provider data retention and training policies are controlled by the selected provider. Review those terms before sending sensitive notes.

## What's New in 0.3.1

- Added clearer mastery record folder selection and vault-relative path guidance.
- Improved OpenAI-compatible URL handling for provider gateways such as OpenRouter and AIHubMix.
- Made model discovery optional when a gateway does not expose `/models`.
- Clarified examiner/verifier roles and mastery grading logic in settings.
- Reduced empty Review Center plan sections and improved the mastery exam modal layout.

## What's New in 0.3.0

- Added pause, resume, and restart-learning workflows.
- Added optional BYOK AI mastery exams, independent verification, confidence levels, reference answers, and delayed rechecks.
- Added multi-provider AI connection profiles and model discovery.
- Added one longitudinal mastery record per source article.
- Added container-responsive Review Center layouts and side-dock-to-main-tab migration.

## Previous 0.2.4 Changes

- Added configurable adaptive interval rules for all four review ratings.
- Added per-note interval previews to the review feedback buttons.
- Preserved the 0.2.2 scheduling defaults and existing frontmatter compatibility.

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
- `Pause Current Note Review`
- `Resume Current Note Review`
- `Start Current Note Mastery Exam`

## Generated Files

- `review-index.json`: Current review index snapshot, overwritten on each generation.
- `review-history.jsonl`: Review event history, appended per review action.
- `review-ai-cards.json`: Current AI review-card prompt payload, overwritten on each generation.
- `00-总览/今日复习.md`: Native Markdown review page, overwritten on each generation.
- `Smart Review/Mastery Records/*.md`: One append-only mastery history per source article.

## GitHub Release Assets

For an Obsidian community release, create a GitHub release whose tag exactly matches the version in `manifest.json`, for example `0.2.4`.

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

Pushing a tag such as `0.2.4` runs the release workflow automatically. The workflow fails if the tag does not match `manifest.json.version`.

## Updating the Installed Plugin

After a GitHub release is published, users can update from Obsidian's Community plugins page. For manual testing before community catalog publication, download `main.js`, `manifest.json`, and `styles.css` from the GitHub release and copy them into:

```text
<Vault>/.obsidian/plugins/smart-review/
```

Then reload Obsidian or disable and re-enable Smart Review.
