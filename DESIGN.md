# Design

## Register

Product. GKFEED is a compact personal feed-management tool where design serves fast scanning, clear actions, and trust.

## Visual Language

The interface uses a warm dark canvas with muted warm surfaces. It should feel practical, quiet, and durable, not like a social feed, enterprise admin panel, or prototype scaffold.

Use familiar product patterns: a persistent top nav, centered task columns, direct forms, clear list/detail states, and restrained motion.

## Color

Global color tokens live in `src/styles.scss` as OKLCH CSS custom properties.

Core roles:

```scss
--color-page: oklch(19% 0.012 28);
--color-surface: oklch(88% 0.026 63);
--color-surface-muted: oklch(84% 0.029 60);
--color-card: oklch(78% 0.041 62);
--color-card-hover: oklch(81% 0.042 62);
--color-card-border: oklch(58% 0.05 48);
--color-field: oklch(91% 0.02 65);
--color-field-focus: oklch(94% 0.018 68);
--color-ink: oklch(31% 0.08 27);
--color-ink-strong: oklch(24% 0.068 28);
--color-ink-inverse: oklch(91% 0.03 78);
--color-accent: oklch(45% 0.132 145);
--color-danger: oklch(53% 0.16 25);
--color-focus: oklch(88% 0.035 78);
```

Use the green accent for primary confirmation actions and active affordances. Use danger red only for destructive actions and validation errors. Prefer `color-mix(in oklch, ...)` for variants instead of introducing unrelated colors.

## Typography

Use the system UI stack from `src/styles.scss`:

```scss
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Typography should stay compact and functional. Do not introduce display fonts for labels, buttons, data, or navigation.

## Layout

The app shell is a top navigation bar with routed content below.

Common widths:

- Feed list/detail: `680px`
- Feed creator host: `480px`
- Creator form: `440px`
- Login panel: `680px`

Use grid for vertical rhythm and form structure. Use flex where inline actions need wrapping.

## Components

Feed cards are the primary product object. In list context, the full card is a link. In detail context, the same visual object becomes an `article`. Keep cards information-first: type mark, title, ID, URL, and a short action hint.

Forms use explicit labels, inline validation, visible status messages, and minimum 44px interactive targets. Login uses a larger panel treatment. Feed creation uses a compact transparent form treatment.

Buttons use consistent rounded corners per context, visible focus outlines, disabled states, and restrained hover movement. Destructive actions require an inline confirmation step before the final request.

## States

Preserve these states:

- Feed list loading skeletons
- Feed list empty state
- Feed list error alert
- Feed search result-count announcement
- Feed detail loading and load error
- Inline delete confirmation, pending state, and delete error
- Feed create saving, success, and error status
- Login saved state and logout action

Skeleton animation must respect `prefers-reduced-motion: reduce`.

## Accessibility

Target WCAG AA. Maintain semantic sections, labeled forms, `aria-invalid`, `aria-describedby`, `role="status"`, `role="alert"`, `aria-current` navigation, visible `:focus-visible` outlines, and screen-reader-only headings/status text where needed.

Dynamic feed search changes should announce a concise result count, not every changed card.

## Responsive Behavior

Breakpoints in use:

- `760px`: navbar stacks; search stretches full width.
- `640px`: form padding reduces and global form actions stack.
- `520px`: feed card padding and type-logo dimensions shrink.

Mobile should keep all primary actions visible and tappable. Avoid hover-only information.
