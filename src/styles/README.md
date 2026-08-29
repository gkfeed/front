# CSS ownership

Keep styles with the smallest unit that fully owns the behaviour:

- `styles.css` contains application-wide foundations and reusable UI primitives.
- Page styles are imported by their page component.
- Reusable component styles are imported by the component itself.
- `reader/layout.css` and `reader/card.css` define only the Reader and card foundations; card media and state rules live in their named sibling modules.
- Reader features and providers own their internal styles, including their viewport variants. For example, short-video rules belong under `reader/short-video/`.
- `reader/responsive/` and `reader/fullscreen/` contain generic context layout and import feature-owned overrides after the generic rules.
- Within fullscreen, `card.css` owns the available card shell and control space, while `media/` owns preview and media sizing within that shell.

Prefer a semantic modifier class or `data-*` state when React already knows the presentation state. Use `:has()` when the layout genuinely depends on child content that the parent does not otherwise know about.

Generic contexts depend on presentation contracts such as `reader-card--landscape-media`
and `reader__item--card-flow`, not on provider or feature names. Shared player
presentation uses `reader-card--player` and `reader-card__copy--player`; provider
classes are reserved for provider-specific styling.

The Reader entry point orders the cascade as foundations, features, responsive context, fullscreen context, and finally the independent article reader.
