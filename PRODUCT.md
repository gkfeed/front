# GKFEED

GKFEED is a compact personal feed reader for collecting sources, reviewing new items, and deciding what to keep. It is designed as a quiet, practical alternative to engagement-driven social feeds.

## Current product

- **Authentication:** users sign in with a username and password. Protected pages return unauthenticated users to the sign-in screen; a saved session can be restored, inspected, and signed out.
- **Source management:** users can search their source list, open source details, add a source from only its URL or enter its title and type manually, and delete a source after confirmation.
- **Reader:** authenticated users can read the current set of feed items in two views. **Review** presents one item at a time with Keep and Delete decisions, a remaining count, reset, keyboard controls, feed priority, and fullscreen support. **Scroll** presents all items in pages and retains per-feed priority controls. Items can be ordered newest-first or oldest-first.
- **Article reader:** supported article links open in a focused in-app reading dialog with parsed headings, text, lists, quotes, and images. Users can return to the feed or open the original page; unsupported links open the original directly.
- **Live:** the Live page checks configured Twitch sources, lists channels that are currently online, and lets the user select and play a stream. Empty and failed checks can be retried.
- **Settings:** users can choose the Reader view and item order, show, blur, or hide supported NSFW sources, include or exclude TikTok items, and select system, light, dark, or Catppuccin themes. Reader-specific choices appear while using Reader.
- **Provider previews:** feed cards show available images, video, embeds, and rich provider data. There are tailored experiences for YouTube, TikTok, Twitch, Instagram, VK, Spotify, Matreshka, Sasflix, HLTV, OneFootball, Liquipedia, Reddit, and ordinary web links, with a usable text or original-link fallback when a preview is unavailable.

The user-facing routes are `/`, `/create`, `/feed/:id`, `/reader`, `/live`, and `/login`.

## Product principles

- **Compact:** prioritize scanability and direct actions over decorative UI or administrative clutter.
- **Trustworthy:** use clear states, predictable navigation, explicit confirmation for destructive source changes, and honest fallbacks when remote content fails.
- **Personal:** keep the experience lightweight, calm, and free of gamification.
- **Accessible:** target WCAG AA with semantic controls, keyboard navigation, visible focus, readable contrast, responsive layouts, plain labels, and reduced cognitive load.
