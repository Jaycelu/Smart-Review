# AI settings and dashboard usability design

## Problem

The 0.3.0 mastery workflow works functionally, but several UI and compatibility details are unclear or brittle:

- Mastery record folder input looks like a plain name and does not clearly say it is vault-relative.
- OpenAI-compatible endpoints are too strict for provider gateways such as OpenRouter and AIHubMix.
- Examiner and verifier roles need clearer explanation in both English and Chinese.
- Empty review plan lifecycle groups consume too much first-screen space.
- The mastery exam modal is too narrow for long generated questions and answers.

## Design

1. Keep all paths vault-relative. Add folder suggestions and a folder picker action for the mastery record folder. Clarify with examples such as `Smart Review/Mastery Records` and `00-总览/Smart Review/Mastery Records`.
2. Normalize OpenAI-compatible URLs. Accept both base URLs ending in `/v1` and full `/chat/completions` URLs. Model discovery remains optional: if `/models` is not available, the user can manually enter a model name.
3. Make examiner/verifier wording explicit. Examiner generates questions and first grade. Verifier only regrades passing or borderline attempts to reduce single-model false positives; empty means reuse examiner.
4. Compress the review plan first screen. Hide empty lifecycle groups, keep future and lifecycle groups collapsed by default, and avoid rendering large empty blocks for collapsed groups.
5. Make the mastery exam modal responsive. Increase usable width/height, wrap long prompt text, constrain textareas to the modal width, and keep action buttons readable on narrow panes.

## Validation

Run typecheck, tests, lint, plugin build, and release asset preparation. Verify English and Chinese strings compile through the shared translation key type.
