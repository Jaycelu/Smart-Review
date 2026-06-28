# Configurable Review Rules Design

## Goal

Allow users to tune the four review outcomes without replacing Smart Review's adaptive spaced-repetition behavior. The defaults must produce exactly the same schedules as version 0.2.2.

## Settings

Add four persisted settings:

- Again interval days: fixed reset interval, default `1`.
- Hard interval multiplier: applied to the current or initial interval, default `1.2`.
- Good interval multiplier: applied in addition to the note's ease, default `1.0`.
- Easy interval multiplier: applied in addition to the note's ease, default `1.3`.

The existing initial interval remains the fallback base for notes without review history. Positive finite values are accepted; invalid values fall back to defaults. Existing installations receive the defaults when settings are merged during plugin startup.

## Scheduling

The shared scheduling function receives the configurable rule values. Its output remains:

- Again: configured reset days; reduce ease and increment lapses.
- Hard: base interval multiplied by the configured Hard multiplier; reduce ease.
- Good: base interval multiplied by current ease and the configured Good multiplier.
- Easy: base interval multiplied by current ease and the configured Easy multiplier; increase ease.

All interval results are rounded to whole days. Hard keeps its existing two-day minimum; the other outcomes remain at least one day.

## Review Center

Each rating button displays the interval that would be applied to that note, for example `Good · 75 days`. The preview and the click action use the same shared calculation so the displayed value cannot diverge from the saved `next_review` date.

Button labels and setting descriptions support English and Simplified Chinese and use Obsidian theme variables.

## Compatibility And Tests

- Missing settings use the 0.2.2 defaults.
- Existing frontmatter fields remain unchanged.
- Shared scheduling tests cover defaults, custom values, invalid values, and existing review history.
- Plugin tests cover settings migration and preview/action consistency where practical.
- Type checking, tests, plugin build, release packaging, and official Obsidian lint must pass before release.
