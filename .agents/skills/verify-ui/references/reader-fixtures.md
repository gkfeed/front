# Reader fixtures

Fixture files live in `dev/reader-fixtures/`. Vite serves their JSON and `assets/` through `/__fixtures/`. They are outside `public/`, the Vite plugin applies only to the dev server, and the fixture bootstrap is excluded from production builds.

## Catalog

| Name | Item ID | Useful for |
| --- | ---: | --- |
| `text` | 1001 | VK text-only card, descriptions, title wrapping, reader actions |
| `image` | 1002 | Landscape image sizing and cropping, regular/fullscreen layout |
| `video` | 1003 | Actual local WebM playback, native controls, regular/fullscreen layout |
| `vk-gallery` | 1004 | Three distinct square photos, slide buttons/counter, VK identity |
| `instagram-portrait` | 1005 | Portrait sizing, Instagram identity, fullscreen controls |

The frames, circles and numbered photos make crop, distortion and the selected slide visible. `sample.webm` is a three-second 480×270 local clip. These assets check the app's media UI; they do not reproduce YouTube/TikTok iframe APIs or live providers.

The text fixture checks the actual description renderer: HTML becomes plain text, body links are not interactive, and mobile descriptions can be clamped. Do not use it as proof of rich-HTML paragraph layout or body-link navigation.

Open `http://localhost:4400/__verify/<name>/reader?view=review`. Use `?view=scroll` for scroll mode. Navbar navigation remains under `/__verify/<name>`, so reloading after navigation retains the fixture. A full navigation outside that prefix leaves the fixture session. A reload restores the original item set, including after Delete.

## A specific custom item

Create `dev/reader-fixtures/my-item.local.json`, then open `/__verify/my-item.local/reader`. The simplest file is one raw API item:

```json
{
  "id": 90210,
  "feed_id": 42,
  "link": "https://vk.com/wall-42_90210",
  "title": "A specific mock item",
  "text": "<p>The content being verified.</p>"
}
```

Use API `feed_id`, not internal `feedId`. IDs must be positive safe integers, item IDs must be unique, and links must be nonempty. `link`, `title` and `text` are strings. The actual production API parsers validate and normalize the payload. Provider selection depends on the item's URL and legacy title, not an extra provider field. Preserve the relevant URL shape when reproducing a provider-specific problem. The real renderer decides whether and how to show feed text; generic cards do not necessarily display raw item HTML.

A fixture may instead contain multiple items and additional data:

```json
{
  "items": [
    {
      "id": 42,
      "feed_id": 1,
      "link": "https://www.instagram.com/p/example/",
      "title": "Portrait item",
      "text": ""
    }
  ],
  "feeds": [
    { "id": 1, "title": "Fixture source", "type": "rss", "url": "https://example.com/feed" }
  ],
  "previews": {
    "https://www.instagram.com/p/example/": {
      "url": "https://www.instagram.com/p/example/",
      "title": "Portrait item",
      "description": "Local portrait example",
      "image": "{{origin}}/__fixtures/assets/portrait.svg",
      "video": null,
      "siteName": "Instagram",
      "type": "article",
      "providerData": null
    }
  },
  "responses": {}
}
```

Feeds are generated from `feed_id` when omitted. Item ordering and provider selection remain the real app's behavior. To inspect one precise item, give the fixture one item; otherwise identify the actually displayed card before taking evidence.

`{{origin}}` is replaced with the current server origin, including inside HTML and preview JSON. Use it for local media, as production parsers often expect absolute URLs. New assets can be `.svg`, `.webm` or `.mp4`; serve them from `dev/reader-fixtures/assets/` with simple alphanumeric/hyphen/underscore filenames. Avoid external media URLs for deterministic checks. Native image/video/iframe loads are not intercepted by the fetch mock. If reproducing an embedded player requires external resources, identify that dependency and the actual coverage instead of calling it fully mocked.

`previews` supplies validated OpenGraph payloads keyed by the normalized item link. Copy the relevant shape from `e2e/reader.spec.ts` or a provider's component tests, including `providerData` for galleries. Unspecified OpenGraph requests return metadata with no media. Add an explicit preview when the scenario requires it.

`responses` supplies JSON for other GET requests, keyed by exact path+query or by path, for example `/bff/article` or `/bff/youtube-comments`. Built-in feed list, item sync and item changes responses take precedence. Match the production response schema for the selected feature; a JSON response alone does not guarantee it is valid.

## Isolation and limitations

The bootstrap installs tab-local localStorage/sessionStorage and fixture credentials before React mounts. Persisted real credentials and preferences are unchanged. Reader cache is isolated by the fixture username and reset before each mount. API reads, item deletion and feed deletion are mocked. Unknown fetch requests return 501, are logged and recorded in `window.__readerFixture.blockedRequests`; they never fall through to real services. Create-feed and other unsupported actions need explicit harness support before they can be verified.

Missing or invalid fixture files show a startup alert rather than opening a normal reader. There is no special fixture-rendering component: the production routes, authentication restoration, parsers, models and card components handle the supplied data.

Useful diagnostics:

```js
({
  url: location.href,
  viewport: { width: innerWidth, height: innerHeight },
  fixture: window.__readerFixture,
  images: [...document.querySelectorAll('.reader-card img')].map(image => ({
    src: image.currentSrc,
    ready: image.complete && image.naturalWidth > 0
  }))
})
```
