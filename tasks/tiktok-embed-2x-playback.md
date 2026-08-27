# TikTok embed: 2× playback

Status: requires brainstorming and further research.

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
