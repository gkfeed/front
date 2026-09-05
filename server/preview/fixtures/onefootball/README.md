# OneFootball status evidence

Captured 2026-09-05 using a browser User-Agent. HTML fixtures retain the original JSON-LD and the page's `matchScore` container; unrelated containers and markup are removed.

| Fixture | Source | Observed period |
| --- | --- | --- |
| scheduled | https://onefootball.com/en/match/2693593 | 1 |
| first-half | https://onefootball.com/en/match/2674760 | 4 |
| full-time | https://onefootball.com/en/match/2700208 | 11 |
| full-time-de | https://onefootball.com/de/spiel/2700208 | 11 |
| abandoned | https://onefootball.com/en/match/2717945 | 2 |
| penalties-ended | https://onefootball.com/en/match/2665774 | 12 |

The provider publishes the period enum in https://onefootball.com/_next/static/chunks/6663-60186cb5fd3c4ec0.js, module 90344. Values are UNKNOWN=0, PRE_MATCH=1, ABANDONED=2, POSTPONED=3, FIRST_HALF=4, HALF_TIME=5, INTERRUPT=6, PENALTIES=7, SECOND_HALF=8, EXTRA_FIRST_HALF=9, EXTRA_SECOND_HALF=10, FULL_TIME=11, FULL_TIME_PENALTIES=12, RESULTS_AFTER_FULL_TIME=13, UNRECOGNIZED=-1.

The live-indicator set in https://onefootball.com/_next/static/chunks/9743-f1b2df4a177272e3.js includes 4, 5, 7, 8, 9, 10. The score banner in chunk 8826-508f62cd0f67cb58.js also includes INTERRUPT, but the live indicator does not. Interruptions and abandoned matches therefore remain unknown. Completed penalties are distinct from active penalties.

No second-half, half-time, extra-time, active-penalty, postponed or interrupted response was available in the captured match listing. Tests construct these periods from the captured first-half response using the provider's published enum. They are not claimed as real captures. Missing, malformed and future values are constructed too. No localized text is accepted as a status signal; English and German completed responses verify locale independence.

Only `props.pageProps.containers[].type.fullWidth.component.contentType.matchScore` with `$case: matchScore` is read. Exactly one summary must match both JSON-LD team names. Nested recommended matches never supply the page status. The original `timePeriod` is retained as `status`; `normalizedStatus: null` represents unknown.

The live adapter polls active candidates every 60 seconds, matching the BFF result-cache TTL, and sweeps dormant candidates within five cycles. Manual refresh may reuse a still-cached result. A tick just before cache expiry may defer fresh data until the next tick. No faster polling or cache-busting query is added. Shared failed-refresh retention expires five minutes after the last successful client snapshot.
