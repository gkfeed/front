# GKFEED Front

React + Vite frontend for managing GKFEED feed sources.

## Development server

Run `npm run dev` and open `http://localhost:4200/`. The application reloads when source files change.

The dev server listens on `0.0.0.0`, so it is also reachable from your local network at `http://<your-lan-ip>:4200/`. In development, API requests use `/api/v1` and are proxied by Vite to `https://feed.gws.freemyip.com` so browsers do not block them with CORS.

Set `VITE_API_ROOT` at build time to override the API URL. The default is the
same-origin `/api/v1` proxy in development and the hosted API URL in production.

## Build

Run `npm run build` to create a production build in `dist/`.

Run `npm test` to execute the automated tests.

Run `npm run check` or `make check` to execute both the test suite and production build.

## Browser automation

Run `npm run test:e2e:install` once to install the Chromium browser used by Playwright.

Run `npm run test:e2e` to execute browser automation tests. Playwright starts the Vite dev server on `http://127.0.0.1:4200/` automatically and reuses an existing server during local runs.

Run `npm run test:e2e:ui` for Playwright's interactive runner.

## Preview

Run `npm run preview` to serve the production build locally.
