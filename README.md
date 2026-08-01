# GKFEED Front

React + Vite frontend for managing GKFEED feed sources.

## Development server

Run `make dev` and open `http://localhost:4200/`. This starts both the Vite
frontend and the TypeScript BFF, and both reload when their source files change.
The BFF listens on `http://localhost:3100` by default.

Use `make dev BFF_PORT=<port>` to select a different BFF port. You can also run
`npm run dev` and `npm run dev:bff` separately; the standalone BFF defaults to
`http://localhost:3000`.

The dev server listens on `0.0.0.0`, so it is also reachable from your local network at `http://<your-lan-ip>:4200/`. In development, API requests use `/api/v1` and are proxied by Vite to `https://feed.gws.freemyip.com` so browsers do not block them with CORS.

Set `VITE_API_ROOT` at build time to override the API URL. The default is the
same-origin `/api/v1` proxy in development and the hosted API URL in production.

## Build

Run `npm run build` to create a production build in `dist/`.

Run `npm start` after building to serve both the frontend and BFF on port 3000.
Set `PORT` to use a different port.

## Open Graph preview

The BFF exposes the Open Graph metadata route:

```text
GET /api/bff/open-graph?url=https%3A%2F%2Fexample.com%2Farticle
```

It returns the final page URL plus its title, description, image, video, site
name, and Open Graph type. The parser uses the same crawler request profile and
Open Graph/Twitter metadata fallbacks as gkbot. Only public HTTP(S) pages are
fetched; private/local addresses, non-HTML responses, large pages, and slow
responses are rejected.

Generated Reddit cards from `share.redd.it` are loaded through
`/api/bff/reddit-preview-image`, which applies the same crawler request headers
as gkbot. That image proxy only accepts Reddit's generated preview URLs.
HLTV match cards use the parsed teams and live/final match data when available,
with the site's generated Open Graph image as a fallback. Like gkbot, the BFF
uses `aria2c` with the crawler request headers for HLTV pages. URL2PNG image
URLs are upgraded to HTTPS before being rendered.

Run `npm test` to execute the automated tests.

Run `npm run check` or `make check` to execute the test suite, lint, browser automation, and production build.

## Browser automation

Run `npm run test:e2e:install` once to install the Chromium browser used by Playwright.

Run `npm run test:e2e` to execute browser automation tests. Playwright starts the Vite dev server on `http://127.0.0.1:4200/` automatically and reuses an existing server during local runs.

Run `npm run test:e2e:ui` for Playwright's interactive runner.

## Preview

Run `npm run preview` to serve the production build locally.
