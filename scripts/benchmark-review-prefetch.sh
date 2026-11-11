#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
baseline=${1:-78053f9}
window=${2:-6202095}
mkdir -p "$root/test-results"
scenario=${BENCH_SCENARIO:-reorder}
reading=${BENCH_READ_MS:-150}
api_first=${BENCH_API_FIRST_MS:-250}
api_next=${BENCH_API_NEXT_MS:-900}
providers=${BENCH_PROVIDER_MS:-120,350,700}
label="$scenario-$reading-$api_first-$api_next-${providers//,/-}"
for variant in baseline window current; do
  dir="$tmp/$variant"
  mkdir -p "$dir"
  if [[ "$variant" == current ]]; then
    cp -a "$root/src" "$root/shared" "$dir/"
  else
    revision=$baseline
    [[ "$variant" == window ]] && revision=$window
    git -C "$root" archive "$revision" src shared | tar -x -C "$dir"
  fi
  mkdir -p "$dir/scripts"
  cp "$root/scripts/benchmark-review-prefetch.tsx" "$dir/scripts/"
  ln -s "$root/node_modules" "$dir/node_modules"
  cp "$root/package.json" "$dir/package.json"
  node --input-type=module - "$dir" <<'NODE'
import { rolldown } from 'rolldown';
const dir = process.argv[2];
const build = await rolldown({
  input: `${dir}/scripts/benchmark-review-prefetch.tsx`,
  platform: 'node',
  external: (id) => !id.startsWith('.') && !id.startsWith('/') ,
  transform: { jsx: 'react-jsx', define: { 'import.meta.env': '{"DEV":false,"PROD":true}' } },
});
await build.write({ file: `${dir}/benchmark.mjs`, format: 'esm' });
await build.close();
NODE
  node "$dir/benchmark.mjs" > "$root/test-results/prefetch-$label-$variant.json"
done
node - "$root/test-results" "$label" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
for (const variant of ['baseline', 'window', 'current']) {
  const r = JSON.parse(fs.readFileSync(path.join(process.argv[2], `prefetch-${process.argv[3]}-${variant}.json`)));
  console.log(JSON.stringify({ scenario: r.scenario, variant, waitForCardMs: r.waitForCardMs, reviewElapsedMs: r.reviewElapsedMs, openedIds: r.openedIds, uniqueOpened: r.uniqueOpened, totalPreviewWaitMs: r.totalPreviewWaitMs, waitsMs: r.waitsMs, states: r.states, providerStarts: r.providerStarts, providerAborts: r.providerAborts }));
}
NODE
