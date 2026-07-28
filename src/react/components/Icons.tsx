export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" width="21" height="21" fill="currentColor">
      <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.3-7.5 5.1 0 1 .8 1.9 1.9 1.9h11.2c1.1 0 1.9-.9 1.9-1.9 0-2.8-3.4-5.1-7.5-5.1Z" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" width="21" height="21" fill="currentColor">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h.5A2.5 2.5 0 0 1 20 12.5v6A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-6A2.5 2.5 0 0 1 6.5 10H7Zm2 0h6V8a3 3 0 1 0-6 0v2Zm3 4a1.5 1.5 0 0 0-1 2.6V18h2v-1.4A1.5 1.5 0 0 0 12 14Z" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.7" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg
      className="nav__brand-mark"
      viewBox="0 0 32 32"
      width="32"
      height="32"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(1 2) scale(.9)"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </g>
      <path
        className="nav__brand-mark-accent"
        d="M25 20.5v9M20.5 25h9"
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
