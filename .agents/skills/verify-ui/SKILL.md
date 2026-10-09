---
name: verify-ui
description: Visually verify GKFEED frontend changes in the real browser UI, including a reader opened with a specific mock item. Use after edits when visual or interaction checks are warranted, or when explicitly asked to verify the UI.
---

# Verify the changed UI

Use this skill at the agent's discretion after edits. Establish whether the changed behavior works and whether nearby user actions still work. Choose scenarios from the task and diff; do not expand a targeted check into a full application audit.

Read [references/reader-fixtures.md](references/reader-fixtures.md) when preparing a reader item, provider preview or custom response. Read [references/scenarios.md](references/scenarios.md) for entrypoints, controls and nearby regression checks.

## Launch

Run from the repository root. Install dependencies with `npm ci` when `node_modules` is absent. Start a frontend on a free port and keep its process/session ID:

```sh
npm run dev:front -- --port 4400 --strictPort
```

Open `/__verify/vk-gallery/reader?view=review` on that server. Replace `vk-gallery` with the fixture relevant to the change. `/reader?fixture=vk-gallery` is an alias that normalizes to the same isolated route.

These are development-only entrypoints. Normal routes use real services; use fixture routes for deterministic checks. The fixture session supplies mock authentication, tab-local preferences and mocked API/BFF responses while mounting the actual app and Reader. It survives SPA navigation. Reloading resets the selected fixture, preferences and reader review state.

For unrelated UI changes, enter the affected page through this session when its mocked data covers the scenario. Extend the fixture's responses or use an already-authorized real environment if needed. Do not claim a fixture proves live provider integration.

## Doctor

Before interacting, confirm the correct worktree, running server and expected fixture. Inspect `window.__readerFixture`: `name` and `itemIds` must match the intended input, and `blockedRequests` must be empty. Wait for the actual `.reader-card` and expected item heading or provider identity, not just the reader's live-region announcement. Wait for images with nonzero natural size and videos with loaded metadata. Check browser console/page errors and failed requests.

Verify the measured CSS viewport using `innerWidth` and `innerHeight`, including after resize. A requested size or screenshot's pixel dimensions alone do not establish the layout viewport.

If readiness fails, distinguish a startup or fixture problem from a product defect. An unsupported or unmocked request makes the affected check inconclusive. Add a justified response or report the exact missing prerequisite; never silently fall through to a live API.

## Drive

Verify the changed scenario at all three CSS viewport sizes:

| Viewport | Width | Height |
| --- | ---: | ---: |
| Desktop 2K | 2560 | 1440 |
| Laptop | 1366 | 768 |
| Mobile | 390 | 844 |

Start each scenario from a known fixture URL. Exercise the relevant action and inspect the resulting state. Include nearby regression checks, such as fullscreen and exit, gallery navigation, Keep/Delete, List and return to Reader. Choose these by the changed behavior; do not run every provider for every small edit.

Visually inspect the rendered UI and saved screenshots: content must be present, media correctly sized, text readable, and controls visible and usable without unintended clipping, overlap or horizontal overflow. DOM assertions and successful screenshots alone do not prove visual correctness. Check mobile-only behavior when affected. These viewport checks do not establish native mobile browser compatibility.

Fix defects introduced by the current changes and repeat the affected checks. Report unrelated defects separately. If a repair requires a new product decision or exceeds the authorized task, explain the specific unresolved behavior.

## Evidence

Prefer T3's collaborative preview when available. Call `preview_status`, then `preview_open` if needed. Navigate, inspect a snapshot, use snapshot-provided locators, and resize to the three sizes. Save snapshots with `save: true`; copy the returned screenshot paths into a run directory under `.verification/` if the tool saved them elsewhere. Keep screenshots and diagnostics after cleanup.

The capture helper also provides reproducible screenshots through the project's existing Playwright installation. It is useful for repeatable evidence, or when interactive preview is unavailable:

```sh
npm run test:e2e:install
node .agents/skills/verify-ui/scripts/capture.mjs --fixture vk-gallery --base-url http://127.0.0.1:4400
```

It captures normal and fullscreen reader states at the three sizes, checks loaded media and records diagnostics in a timestamped `.verification/` directory. Open the generated PNGs and inspect them. The helper performs smoke checks; perform the changed interaction and nearby actions separately. Use `--view scroll` for scroll mode, which has no reader fullscreen control.

Report the fixture and item IDs, route, measured viewports, actions and observed results. Link the useful screenshots. Say what was not checked. Use `verified`, `failed` or `inconclusive` for each scenario and state why. Record the revision and working-tree changes with evidence so screenshots can be traced to the code checked. Do not add golden screenshot comparisons unless requested.

Run the focused unit/component or E2E checks relevant to code changes in addition to visual inspection. `npm run check` is the repository's full suite, not a prerequisite for every visual pass.

## Cleanup and maintenance

Stop only processes started for this check, unless retaining the preview is useful for the user's review. Do not kill another session's server or clear real credentials/storage. Fixture-only IndexedDB records use `__verification__:<fixture>`; reopening that fixture clears only its own cache. Temporary `*.local.json` fixtures and `.verification/` evidence are gitignored.

When a recorded route, selector or command becomes stale, update the affected skill reference and exercise that path before calling the update verified. Keep product defects distinct from outdated verification instructions.

The workflow borrows reproducible launch, readiness, driving and evidence practices from [pstack's verification generator](https://github.com/cursor/plugins/blob/main/pstack/skills/create-verification-skill/SKILL.md) and [maintenance skill](https://github.com/cursor/plugins/blob/main/pstack/skills/maintain-verification-skill/SKILL.md).
