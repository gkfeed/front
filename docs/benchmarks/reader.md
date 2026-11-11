# Reader latency benchmark

Run `npm ci` and `npm run test:e2e:install` once, then:

```sh
npm run bench:reader
```

The command builds the current frontend in production mode with a local API root, starts an isolated HTTP server on a random loopback port, and runs headless Chromium sequentially. It closes the browser and server and removes the temporary build after the run. Reports and screenshots remain in `.verification/reader-benchmark-<timestamp>/`.

## First-item metric

`firstItemMs` measures navigation start to the first visible `.reader-card` with the expected visible heading. For SPA navigation, the start is the captured click event on the Reader link, after session restoration on Settings has finished. The title and card must remain visible over two consecutive animation frames. The second frame approximates the first opportunity to paint the content; this is not a compositor presentation timestamp. `domReadyMs` records the earlier frame.

The title is the first-item criterion. The benchmark does not explicitly wait for preview, image or video readiness or completion of the entire sync. However, the current generic card hides its copy while its preview is pending, so its preview request contributes to this metric. It does not count a skeleton, hidden accessibility announcement, or just a mounted DOM node.

## Next-item metrics

After the first card becomes visible, the browser clicks the real Keep button immediately and measures the next different card with the same two-frame visibility criterion. It repeats this for `BENCH_NEXT` items, default 20. This crosses the 3-item preview prefetch window and attempts to advance beyond the initial 10-item page. `BENCH_NEXT=0` runs only the original first-item measurement. N must be smaller than the dataset size.

Each sample includes every transition's actual item IDs, position, `clickToVisibleMs`, cumulative `elapsedFromFirstMs`, and whether the target ID was already seen. `uniqueNewItems` and `repeatedItems` distinguish new content from repeated cards. N counts Keep transitions, not distinct items; a series with fewer than N unique new items is explicitly reported. The series records `totalWaitMs`, `elapsedFromFirstMs`, and `fromOpenMs`. The total wait excludes the initial opening. The report summarizes median, p95 and maximum over all measured transitions, total-series median and p95, and median/p95 for each position. Pooled transition percentiles combine completed transitions across runs; series percentiles combine independent completed runs. A transition with no different card after 15 seconds is recorded as a blocked, censored observation. It is excluded from completed-transition percentiles. Incomplete series have no total-series estimate; the report shows completed and blocked series counts. Position details expose stalls that the overall median can hide.

There is no simulated reading delay or Playwright round trip between cards. Clicks invoke the actual DOM button and React handler in the browser; they do not include physical pointer dispatch. Prefetch and background sync keep running normally. This is a rapid Keep sequence, not a Delete persistence benchmark or a measurement of network completion for all N items. The timeout is 15 seconds per transition; a missing next card records a blocked series. Instrumentation errors and missing initial content still fail the run. Repeated cards are reported instead of assuming that every Keep reveals a previously unseen item.

## Conditions

- Production frontend, Chromium desktop at 1366 × 768, English, no CPU throttling.
- 1,000 deterministic text items across 10 RSS feeds, descending IDs, default review mode and preferences.
- Actual application routes and real HTTP requests to synthetic local API/BFF endpoints. The benchmark respects requested pagination limits and cursors, including the initial 10 items and subsequent pages of 100.
- Delay per API/BFF response is 0 ms, 150 ms or 3,000 ms. Static assets use localhost without added delay. This models slow request responses, not constrained bandwidth or packet loss.
- Fresh browser context for each sample, synthetic credentials, no real account. External requests fail the run. Playwright routing disables the HTTP asset cache in all scenarios.
- Cold runs have empty IndexedDB. Cached runs seed the application's actual IndexedDB schema with the full snapshot and a valid sync cursor. This models reopening with persisted data, not an in-memory Reader remount. The cached document navigation still includes authentication restoration and feed-list loading.
- SPA runs start on Settings with authentication restored, then click Reader. Items are not seeded in that scenario.
- Normal scenarios use 20 measured samples and 2 discarded warmups each. Slow scenarios default to 10 measured samples. Percentiles use the nearest rank, with the lower middle observation as the median for an even sample count. Small-sample p95 is sensitive to outliers.

The JSON includes every sample, API/BFF Resource Timing entries observed by the measurement, revision and working-tree status, browser and machine details. Screenshots show the last card in the final measured series of each scenario. An unhandled browser error, external request, unsupported API request, or missing initial card fails the benchmark. A next-item timeout is preserved as a blocked measurement.

```sh
# Slow responses only, one discarded warmup per scenario
BENCH_SLOW_ONLY=1 BENCH_WARMUPS=1 npm run bench:reader

# Select cases, sample count, next-item count or dataset size
BENCH_SCENARIOS=spa-api-150ms,spa-api-3000ms npm run bench:reader
BENCH_RUNS=30 BENCH_SLOW_RUNS=15 BENCH_ITEMS=10000 BENCH_NEXT=20 npm run bench:reader
```

Compare the same scenario, item count, machine, browser, viewport and delays after an optimization. These are controlled frontend measurements, not production latency or measurements on a physical phone.

## Baseline on 2026-11-10

Frontend revision `78053f98aeaa5708c9573500e61cf5c11b145d1c`. Raw samples and environment: [reader-baseline.json](reader-baseline.json).

| Scenario | Samples | Median, ms | p95, ms |
| --- | ---: | ---: | ---: |
| cold-api-0ms | 20 | 411.4 | 427.8 |
| cold-api-150ms | 20 | 861.6 | 873.7 |
| cached-api-150ms | 20 | 843.2 | 850.9 |
| cold-api-3000ms | 10 | 9411.1 | 9423.0 |
| cached-api-3000ms | 10 | 9384.7 | 9397.6 |
| spa-api-150ms | 20 | 580.6 | 581.2 |
| spa-api-3000ms | 10 | 6279.9 | 6281.0 |

Fast document-navigation cases used 2 warmups. Slow document navigation and both SPA cases used 1 warmup. Browser errors and unsupported or external requests were absent in the accepted runs. The saved card screenshot was visually checked.

With 3-second responses, persisted items barely change the result. Authentication restoration, the Reader feed-list request, and generic-card preview gating still precede visible content. SPA navigation after authentication removes the restoration wait but still takes about 6.28 seconds. This is a baseline finding; no Reader optimization is included.

## Next-item baseline on 2026-11-11

Raw samples: [reader-next-baseline.json](reader-next-baseline.json). Three measured runs per scenario, no warmups, 1,000 items and 20 rapid Keep transitions per run. These are exploratory baseline samples; small-sample p95 is not a stable population estimate.

| Response delay | First item median | Completed transition median | Completed transition p95 | Completed series | New unique items per series |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 ms | 418.0 ms | 33.3 ms | 33.4 ms | 3/3 | 20 to 20 |
| 3000 ms | 9408.4 ms | 33.3 ms | 2933.2 ms | 0/3 | 9 to 9 |

Without added response delay, the 20-transition series completes in about 0.665 seconds. With 3-second responses, transitions 4 and 8 wait about 2.93 seconds. After the first 10 cards, the Reader repeats already seen IDs. All three runs block at transition 20 for at least 15 seconds, so there is no completed 20-transition series time for that scenario. Only nine unique new items were observed per slow run. Median-only reporting would hide both the preview stalls and the missing next card.

This PR records that behavior without changing Reader loading or review-session logic. The next optimization should compare the same rapid navigation and separately check that all N next items are distinct.

## Repeat after PR #17

The same cold, 3-second response scenario was repeated on merge revision `5fe3d467070c23516158cc515c3616123a61f40f`, which combines this benchmark branch and PR #17. The [raw report](reader-after-pr17.json) contains three runs, no warmups, with 20 rapid Keep transitions each. First-card times were 9,429.6, 9,417.3 and 12,409.2 ms. The longer run started four speculative preview requests before the visible card's preview; the other two started the visible request first. This small synthetic sample shows a possible queue race, not an estimated production regression.

All three runs completed 20 transitions to 20 distinct new IDs with no blocked transition. Completed-transition median was 33.3 ms and pooled p95 was 2,899.9 ms; median total transition wait was 15,015.1 ms. Each transition has no reading pause. These results do not measure TikTok playback readiness and should not be compared with a reading-pause workload as if the workloads were identical.
