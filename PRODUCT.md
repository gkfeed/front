# GKFEED

GKFEED is a compact personal feed reader for collecting sources, reviewing new items, and deciding what to keep. It is designed as a quiet, practical alternative to engagement-driven social feeds.

## Current product

- **Authentication:** users sign in with a username and password. Protected pages return unauthenticated users to the sign-in screen; a saved session can be restored, inspected, and signed out.
- **Source management:** users can search their source list, open source details, add a source from only its URL or enter its title and type manually, and delete a source after confirmation.
- **Reader:** authenticated users can read the current set of feed items in two views. **Review** presents one item at a time with Keep and Delete decisions, a remaining count, reset, keyboard controls, feed priority, and fullscreen support. **Scroll** presents all items in pages and retains per-feed priority controls. Items can be ordered newest-first or oldest-first. Manual feed priorities and automatic prioritization can be enabled separately. Automatic prioritization alternates sources, taking one item per source in each round and showing preferred sources first within the round. Manual feed priority defines separate tiers; all items in a higher tier precede lower tiers. Item order is preserved within each source. When automatic prioritization is disabled, items use manual priority followed by the selected item order.

Automatic scores use a smoothed keep rate: `(weightedKeeps + 2) / (weightedReviews + 4) - 0.5`, added to the manual priority. Each decision has weight `2 ** (-ageDays / 30 - newerSourceReviews / 50)`. Older decisions lose half their weight after 30 days or 50 later decisions for the same source. New decisions include a timestamp; legacy decisions without timestamps fade through later source decisions only. Repeating an unchanged decision does not refresh its weight. Scores are recalculated on opening Reader, changing prioritization preferences, and recording decisions. Automatic scores are compared to three decimal places to keep tiny timing differences from reshuffling equivalent sources; manual tiers always take precedence. History remains local to the browser and user, capped at 5000 unique items.

Keeping an item from a feed whose exact type is `rezka` keeps all items in that feed for the current review session, including episodes arriving during synchronization or after a reload. Only the selected episode returns in the revisit round. Another episode never replaces it if it disappears. Reset clears the grouped keep. `rezka:collection` and other feed types retain per-item Keep behavior. Grouped Keep contributes only the user's explicit decision to automatic prioritization, rather than recording inferred decisions for unseen episodes. Reader loads feed types before enabling review actions and offers retry if this lookup fails.
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
