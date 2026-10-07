# Built-in frontend plugins

Plugins are compiled into GKFEED. They are provider capabilities, not external
scripts. `generic` is the mandatory fallback and has no toggle.

## Registration

`src/react/domain/feedItemProviderPresentation.ts` owns the React-free catalog.
`defineFeedPlugin(id, title, definition)` validates the analyzer payload against
the provider's tagged identity. A definition contains URL/legacy matchers,
`analyze`, loading rules, optional Live capability, and an optional settings
schema/version. URL detection runs before the enabled gate; disabling a real
match must not accidentally activate a legacy matcher.

`components/providers/feedPluginUiCatalog.tsx` associates ids with lazy `loadUi`
capabilities. A UI renderer returns `preview`, `copy`, and optional
`supplementary` slots. The common card shell owns loading and copy visibility;
the plugin boundary catches loading/render failures and keeps an ordinary link.

`components/live/liveProviderRegistry.tsx` binds declared Live capabilities to
adapters. The runtime owns discovery, refresh schedules, cancellation and cache
coverage. Adapters recognize candidates and check them using the supplied
`AbortSignal`; they must not schedule their own background loops. Mounted UI may
make user-triggered requests.

Adding a built-in provider requires a tagged identity, core definition, UI
registration, and (only if declared) a Live adapter. Third-party loading and an
open-ended payload type are intentionally not supported.

## Preferences and settings

- All plugins default to enabled. Disabled ids live in
  `gkfeed.disabledPlugins.v1`; unknown ids are ignored and removed on the next
  write. Preferences are browser-wide, not account-specific, and sync on
  `storage` events (including clearing storage).
- Settings support boolean/select schemas. `PluginSettingsProvider` validates
  fields independently and uses `gkfeed.pluginSettings.<id>.v<version>`.
  Optional `legacyStorageKey` fields migrate after mount; old keys are removed
  only after a successful write. Values remain usable when storage fails.
- `PluginSettingsFields` provides schema controls and allows custom React
  controls receiving `value`, `setValue`, `disabled`, and `t`. Nested settings
  remain visible but disabled when the plugin is off. TikTok's hide setting is
  retained but stops filtering Reader items while the plugin is disabled. Its existing player
  and filter hooks are compatibility facades over the generic settings store.
- `/settings` requires authentication. Reader defaults persist separately;
  explicit `?view=review`/`?view=scroll` overrides them.

## Disable lifecycle

Disabled cards use generic analysis/rendering. Ordinary Open Graph metadata
remains allowed, but foreign provider data, provider proxy videos and VK embeds
are not consumed. A provider change aborts active preview/prefetch subscribers;
late results must not start new media requests or update a new scope.

Disabled Live providers are excluded immediately. Auto and manual refresh share
the current runtime signal. Transactions are abortable, persisted candidates
are pruned for every account even on Settings, and cache coverage excludes
disabled ids. Re-enabling an uncovered provider forces a historical scan rather
than an incremental scan. Disabling all Live providers stops discovery/timers
and displays a Settings link. Playback-progress storage is not deleted.

Regression tests cover cancellation with non-cooperative promises, manual
refresh/unmount, historical coverage, renderer failures, settings migration and
storage recovery. Browser tests cover cross-tab toggles, Reader defaults, route
protection and IndexedDB pruning outside the Live page.
