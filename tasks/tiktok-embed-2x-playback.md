# TikTok embed: 2× playback

Status: implemented with a separate persisted player preference and iframe fallback.

## Implemented behavior

- Settings → TikTok player offers Embed and Preview independently of the hide-TikTok preference. Embed remains the default; the selection is saved in localStorage.
- Preview resolves a fresh direct media URL through `/bff/tiktok-playback`. This request is independent of comments and does not cache signed playback URLs in the BFF result cache.
- The native player shows an accessible `2×` toggle only for a finite duration greater than 60 seconds. It changes the actual media playback rate between 1 and 2 and resets on a new post.
- Provider failures, invalid media URLs, media errors, and a 15-second metadata timeout fall back to the official embed. Only one player is mounted at a time. Late responses for previous posts are ignored.
- The existing sound gesture is shared with the fallback player. The native player retains standard video controls; TikTok's own internal overlays remain available in Embed mode.

Validation: all 649 unit tests, lint, type checking, production build, and bundle budget passed. The new browser scenario passed. A live app check using the supplied post and the real BFF measured 6.004792 media seconds over 3.0002 wall seconds at 2×; returning to 1× and switching to Embed also worked. Audio was muted during this check.

The full E2E run had four fullscreen-layout failures. Three reproduced against an isolated HEAD checkout. The fourth passed on HEAD and in three repeated runs with these changes. These existing or intermittent layout failures are outside this task.

The research notes below describe the investigation that led to this implementation.

## Direct-video experiment, 2026-09-05

Test post: https://www.tiktok.com/@rus_goest/video/7681860124163476754

TikWM's existing `/api/?url=...` endpoint returned `code: 0`, `duration: 167`, and absolute `play` and `wmplay` media URLs. The response did not include `hdplay`. The `play` URL pointed to `v16m.tiktokcdn-us.com` and reported a size of 20,558,776 bytes.

A fresh headless Chromium session loaded that URL into a native `<video>` from a local HTTP page, without a media proxy, TikTok login, or custom media request headers. The browser reported a 576 × 1024 video with duration 167.135011 seconds. After a brief settling interval at each rate, three-second measurements produced:

| Requested and observed rate | Wall time | Media time advanced |
| --- | --- | --- |
| 1× | 3.0002 s | 3.0002 s |
| 2× | 3.0002 s | 5.9975 s |
| 1× | 3.0001 s | 3.0001 s |

The video remained playing with `readyState: 4` at each measurement. This verifies real playback-clock acceleration and restoration, rather than seeking or merely updating a button. Playback was muted, so audible quality and audio/video synchronization were not assessed.

A separate request with `Range: bytes=0-1023` returned HTTP `206`, exactly 1,024 bytes, `Content-Range: bytes 0-1023/20558776`, and `Content-Type: video/mp4`. The CDN also returned `Accept-Ranges: bytes` and `Access-Control-Allow-Origin: *`. These observations apply to this URL at test time; its cache headers do not establish the signed URL's lifetime.

This sample supports trying a hybrid native player with iframe fallback. It does not establish reliability across videos, browser engines, geographic locations, or different server and browser IPs. URL expiry, unavailable posts, audible playback, and preservation of required player controls still need testing. The original TikTok page could not be opened by the research browser, and no undocumented iframe speed command was tested.

Temporary responses and measurements were stored under `/tmp/gkfeed-tiktok-spike/`. Signed media URLs are deliberately omitted here because they are not permanent playback identifiers. No runtime code was changed by this experiment.

## Research findings, 2026-09-05

The official iframe cannot currently support this feature through its documented API. The initial recommendation was to verify a direct-video source before implementing a hybrid player.

- TikTok's [Embed Player documentation](https://developers.tiktok.com/docs/en/embed-player) still lists no playback-rate command or speed query parameter. It exposes duration through `onCurrentTime`.
- The browser's [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) prevents this app from accessing the iframe's internal video element. Changing iframe attributes or adding CORS headers to our BFF does not grant that access.
- No verified undocumented speed command was found. The [Video.js TikTok adapter documentation](https://videojs.org/docs/framework/react/reference/tiktok-video) also reports no playback-rate support. Loading TikTok's example player through the research browser failed, so this investigation did not inspect its runtime message handler or test candidate commands. Absence from documentation does not prove that no internal command exists.
- A video element owned by the app supports actual speed changes through [`playbackRate`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate). This requires a playable media URL, not a TikTok page or embed URL.
- TikTok's [Display API video object](https://developers.tiktok.com/doc/tiktok-api-v2-video-object) exposes duration and embed links, but does not document a direct video media URL.

## Repository findings before implementation

- `src/react/domain/tiktokPreview.ts` builds an iframe URL from the post ID.
- `src/react/components/previews/TikTokEmbed.tsx` renders that iframe and handles the sound prompt.
- `src/react/components/previews/tikTokPlayerProtocol.ts` validates the message origin, source window, and player marker. It currently receives only readiness messages and sends `play` and `unMute`.
- `server/tiktokDetails.ts` already calls TikWM for metadata and falls back to TikTok oEmbed. `server/tiktokDetailsParser.ts` extracts only description and creator metadata. No playable URL is exposed through `shared/tiktokContracts.ts`.

The direct-video experiment above verifies TikWM media fields and browser playback for one post. URL expiry and redistribution permissions remain unverified. Playback resolution should be independent of the comments request so disabling comments does not disable video playback.

## Original implementation proposal

1. Verify a media source with several available long and short posts. Record the actual response schema, redirects, content type, browser playback behavior, and whether URLs depend on cookies, request headers, or client IP. Measure expiry rather than assuming a lifetime. Include unavailable and deleted posts.
2. If direct browser playback works, add a validated playback-source contract and a dedicated resolver. Keep URLs short-lived in application state until their lifetime is known. Reject malformed responses and ignore responses for a previously selected post.
3. Add a native video branch with the existing sound-gesture behavior. Keep only one player mounted. Use the iframe when resolution fails, metadata times out, or native playback fails; hide the speed button in that fallback. Do not treat an autoplay rejection alone as a broken media source.
4. Show the button only when `Number.isFinite(video.duration) && video.duration > 60`. Set `video.playbackRate` to `1` or `2`, and reflect the actual rate via `ratechange`. Give the `2×` toggle a stable accessible name and `aria-pressed` state.
5. Reset speed to `1×` on each post change. Exactly 60 seconds remains excluded. These are proposed defaults based on the goal; persistent speed and a `1.5×` option would be separate decisions.
6. Verify the duration boundary, invalid duration, real rate changes, accessible state, post changes, stale resolver results, mute behavior, and a single transition to iframe fallback. Run a browser check with real media to verify audio and video speed together.

A native player replaces TikTok's internal controls and overlays. App-owned comments can remain, but preserving TikTok's exact player UI is incompatible with this approach. If that UI is mandatory, defer the feature until TikTok exposes a suitable API.

## BFF proxy assessment

Use a media proxy only if the feasibility spike shows why direct browser playback fails and demonstrates that proxying resolves it. A proxy does not itself produce a valid media URL or prevent upstream expiry.

A proxy design would need bounded streaming, request cancellation, timeouts, concurrency limits, and correct Range behavior, including upstream `206` and `416` responses and relevant content headers. Restrict media hosts and validate redirects to avoid fetching arbitrary internal URLs. Cache duration must follow measured URL validity and provider permissions; do not persist signed media URLs as permanent feed data.

Estimate traffic before adopting it: serving a file of size S for N complete views transfers approximately N × S bytes out of the BFF, with additional upstream traffic on cache misses. Faster playback does not halve the media bytes and can increase required throughput. Provider terms and rights to proxy or cache media remain unresolved and need a separate review before deployment.

The implementation uses direct browser playback. A media proxy was not needed for the supplied test post.

## Goal

For TikTok videos longer than one minute, show a `2×` button that toggles the playback speed between `1×` and `2×`.

## Current limitation

Videos are currently played through the official TikTok Embed Player in a cross-origin `iframe`.

- The duration can be obtained from the `onCurrentTime` message (`currentTime`, `duration`) and used to check `duration > 60`.
- The official Embed Player API supports `play`, `pause`, `seekTo`, `mute`, and `unMute`.
- The API does not provide a command for changing `playbackRate`.
- The internal HTMLVideoElement cannot be accessed because the iframe is cross-origin.

Documentation: https://developers.tiktok.com/docs/en/embed-player

## Options to discuss

1. Check whether TikTok has added an official playback-speed API to the Embed Player.
2. Investigate whether a stable undocumented `postMessage` command exists, while accounting for the risk that it may break without notice.
3. When a direct video URL is available, play it with our own HTMLVideoElement and set `video.playbackRate = 2`.
4. Implement a hybrid mode: use our own player for videos with a suitable direct URL and fall back to the TikTok iframe.
5. Evaluate proxying videos through the BFF, including TikTok URL lifetimes, Range requests, load, caching, and legal or platform restrictions.
6. If playback-speed control is impossible, consider a skip-forward button as a separate feature without presenting it as `2×` playback.

## Open questions

- How important is it to preserve the original TikTok player controls and the statistics displayed over the video?
- Are temporary or unstable direct video URLs acceptable?
- Do we need only `2×`, or a `1× / 1.5× / 2×` selector?
- Should the selected speed be remembered between videos?
- How should exactly 60-second videos be handled: show the button for `> 60` or `>= 60`?

## Preliminary acceptance criteria

- The button appears only after a valid duration has been received and only for long videos.
- Pressing the button changes the actual audio and video playback rate rather than seeking forward.
- The current speed is clear from the button state and is accessible to screen readers.
- When the video changes, the player state is reset or restored correctly according to the chosen behavior.
- A fallback exists for unavailable direct videos or changes in TikTok behavior.
