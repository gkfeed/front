# GKFEED Front

React + Vite frontend for managing GKFEED feed sources.

## Development server

Run `npm run dev` (or `make dev`) and open `http://localhost:4200/`. This starts both the Vite
frontend and the TypeScript BFF, and both reload when their source files change.
The BFF listens on `http://localhost:3000` with npm and `http://localhost:3100`
with Make by default.

Set `BFF_PORT=<port>` to select a different BFF port. You can also run
`npm run dev:front` and `npm run dev:bff` separately.

HLTV sometimes blocks requests from local development IPs. `npm run dev` falls back to the
hosted BFF for HLTV previews when the local fetch fails. Set
`HLTV_PREVIEW_FALLBACK_ORIGIN` to change that origin, or to an empty value to disable the fallback.

The dev server listens on `0.0.0.0`, so it is also reachable from your local network at `http://<your-lan-ip>:4200/` or, when `gkfeed.local` resolves to this machine, at `http://gkfeed.local:4200/`. Vite allows the `gkfeed.local` host header for this LAN setup. Set `FRONT_HOST` or `FRONT_PORT` when invoking `make dev` to override the frontend bind address or port. In development, API requests use `/api/v1` and are proxied by Vite to `https://feed.gws.freemyip.com` so browsers do not block them with CORS.

Set `VITE_API_ROOT` at build time to override the API URL. The default is the
same-origin `/api/v1` proxy in development and the hosted API URL in production.
Item synchronization uses the corresponding `/api/v2/items` routes. The development
server proxies both API versions.

## Build

Run `npm run build` to create a production build in `dist/`.

Run `npm start` after building to serve both the frontend and BFF on port 3000.
Set `PORT` to use a different port.

Set `OPENROUTER_API_KEY` on the BFF process to enable Jev-assisted feed type detection in the
manual source form. The key stays on the server. GKFEED sends the source URL and optional title
to OpenRouter's Decisions API with the `typesafe/jev-1.13` model.
For local development, put the key in `.env`; the `dev`, `dev:bff`, and `start` scripts load that
file when it exists. Docker Compose passes the same variable from its environment or `.env` into
the application container.

If the BFF runs behind a reverse proxy, set `BFF_TRUSTED_PROXY_CIDRS` to the comma-separated
IP addresses or CIDR ranges of proxies that connect directly to the BFF. The proxy must append
the client address to `X-Forwarded-For`. Direct connections and requests from unlisted proxies
ignore that header. Docker Compose passes this setting from its environment or `.env`.

## YouTube channel URLs on creation

Before saving a channel feed, `saveFeed` converts handle URLs such as
`https://www.youtube.com/@sendependa_dio_games/videos` to
`https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/videos`.
It preserves the selected channel tab, including `/videos`, `/shorts`, and
`/streams`, and removes query/share parameters and fragments. Both manual and
URL-only creation use this conversion. Already permanent URLs need no lookup;
video and playlist URLs are left unchanged. Existing feeds are not migrated.

The bundled BFF provides the resolver API:

```text
GET /bff/youtube-channel?url=<encoded YouTube channel URL>
200 {"channelId":"UC5TRrMsWLy7flttFTyS-bOA","url":"https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/videos"}
```

Accepted channel addresses use `youtube.com`, `www.youtube.com`, or
`m.youtube.com` and `/@handle`, `/c/name`, `/user/name`, or `/channel/<ID>`,
optionally followed by a recognized channel tab. The resolver fetches the
channel root and reads its explicit canonical, Open Graph URL, RSS link, or
head `channelId` metadata. It never searches for a similar handle or uses IDs
from recommended content. Missing or conflicting IDs, non-channel redirects,
upstream errors, timeouts, and oversized/non-HTML pages fail without saving a
feed. These failures use the existing BFF error response and the form's existing
save-error state, preserving entered values for retry.

Errors have the existing shape `{"error":{"code":"...","message":"..."}}`.
Missing/invalid input returns 400; unresolved or inconsistent channel metadata
returns 502 with `youtube_channel_unresolved`. Upstream fetch failures use the
existing provider codes/statuses. No create request is sent after any failure.

Requests use the BFF concurrency/rate limits, public-address validation, and
deadlines. Channel HTML has a 3 MB limit because YouTube emits page metadata
after large inline styles/scripts. Completed resolutions are not cached since
handle ownership can change. The client validates the ID, canonical URL, and
unchanged tab before sending the existing `/api/v1/add` request.

This frontend depends on the new `/bff/youtube-channel` route in this repository's
BFF; frontend and BFF must be released together. No external feed API or parser
change, YouTube API key, or new environment variable is required. YouTube Data
API [`channels.list`](https://developers.google.com/youtube/v3/docs/channels/list)
also offers exact `forHandle`/`forUsername` lookup, but this implementation uses
the available public page metadata without adding a key dependency.

## Open Graph preview

The BFF exposes the Open Graph metadata route:

```text
GET /bff/open-graph?url=https%3A%2F%2Fexample.com%2Farticle
```

It returns the final page URL plus its title, description, image, video, site
name, and Open Graph type. The parser uses the same crawler request profile and
Open Graph/Twitter metadata fallbacks as gkbot. Only public HTTP(S) pages are
fetched; private/local addresses, non-HTML responses, large pages, and slow
responses are rejected.

Reddit post previews use Old Reddit's title, video poster, and HLS stream so
videos play inline with audio. If Old Reddit is unavailable, the crawler page
provides a fallback preview. Post titles remain visible beneath the media.
Generated Reddit cards from `share.redd.it` are loaded through
`/bff/reddit-preview-image`, which applies the same crawler request headers
as gkbot. That image proxy only accepts Reddit's generated preview URLs.
HLTV match cards use the parsed teams and live/final match data when available,
with the site's generated Open Graph image as a fallback. Like gkbot, the BFF
uses `aria2c` with the crawler request headers for HLTV pages. URL2PNG image
URLs are upgraded to HTTPS before being rendered.

Run `npm test` to execute the automated tests.

Run `npm run check` or `make check` to execute the test suite, lint, browser automation, and production build.

## Browser automation

Run `npm run test:e2e:install` once to install the Chromium browser used by Playwright.

Run `npm run test:e2e` to execute browser automation tests. Playwright starts the Vite dev server on `http://127.0.0.1:4300/` automatically and reuses an existing server during local runs.

Run `npm run test:e2e:ui` for Playwright's interactive runner.

## Preview

Run `npm run preview` to serve the production build locally.
