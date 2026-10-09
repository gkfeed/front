# Choose a scenario from the change

Use the fixture prefix `/__verify/<name>` for these entrypoints. Inspect a fresh semantic snapshot before clicking. English accessible names below match the current app; if the browser locale is Russian, use its observed names rather than assuming English selectors.

## Reader content and layout

Enter `/reader?view=review`. Wait for the actual item heading or provider identity in `.reader-card` and for its expected media. Inspect at 2560×1440, 1366×768 and 390×844. Check title/description, provider identity, expected media dimensions and cropping, and reachability of Keep/Delete and fullscreen controls. Scroll when needed and inspect the lower part of a tall card. A screenshot of an item announcement without a visible card is a failed readiness check.

Nearby checks: enter fullscreen with the button named `Open Reader fullscreen` within `nav`; wait for `main[data-reader-fullscreen="true"]`. Inspect media and controls, then use `Exit Reader fullscreen` within `main` and confirm the attribute clears. The same accessible name can occur in both toolbars after automatic fullscreen, so scope controls to their toolbar. Visit `List` and then `Reader`; verify the same intended content can render. Reopen the known URL to reset state.

Instagram and other short-media cards can automatically enter fullscreen on mobile. Inspect the initial state before looking for an Open button. When already fullscreen, use Exit to inspect the normal card, then reopen fullscreen if needed. This is expected provider behavior.

Existing references: `e2e/reader.spec.ts`, `e2e/responsive.spec.ts`, `src/react/components/FeedItemCard*.test*`.

## Gallery

Use `vk-gallery`. Within `.reader-card__vk-carousel`, click `Next slide`, observe a different image and the `2 / 3` counter, then `Previous slide`. Repeat the relevant transition in fullscreen. The three numbered local assets provide a visual oracle. Keyboard navigation is appropriate when keyboard/fullscreen behavior changed.

## Video

Use `video`. Wait for `video.readyState >= 2`, a 480×270 intrinsic size and a finite three-second duration. Verify playback advances and native controls remain usable, then pause for a stable screenshot. Check normal/fullscreen layout and exit. This verifies the app's native video path; use a different fixture and explicitly supplied responses for provider-specific or embedded-player changes.

## Reader actions and modes

Use a single item for precise rendering, or a custom multi-item fixture for transitions. Keep preserves the item. When all items have been reviewed, Reader revisits kept items and exposes Reset; a single kept item can remain displayed. Delete removes the current item from pending review and advances or shows an empty state. Delete must appear in `window.__readerFixture.requests` as `DELETE /api/v1/items/<id>`. Reopen the fixture URL and confirm the original item returns. Enter `/reader?view=scroll` when scroll mode is affected; fullscreen review controls are intentionally absent there.

Feed priority and Settings changes are session-local. When these controls are affected, change the value, return to Reader and verify the resulting behavior before reloading, which resets fixture preferences.

## Feed list and return

Click `List`, wait for the `Feed sources` heading and expected generated source. The source link is named `Open feed Fixture feed <id>`. Open details if affected, then return through `Reader`. A fixture covers source reads and deletions, but does not cover create-feed submissions, live provider integrations or arbitrary settings-dependent remote actions by default. Report or extend missing data before judging those paths.
