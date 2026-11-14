# Browser session deployment readiness

Checked on 2026-10-20, approximately 06:40–06:44 UTC. This is a point-in-time
report. All server inspection was read-only. No migration, deploy, configuration
change, production login or password exchange was performed.

The frontend auth transition is blocked. This draft prepares the local cookie
transport; it does not switch the browser auth flow. Existing credentials storage,
Basic headers and the production API root still need replacement after readiness
is confirmed.

## Release states

- **Merged:** [infra #2](https://github.com/gkfeed/infra/pull/2), master commit
  `76b69007f77e2cea64113b90bd74219128958209`, and
  [API #7](https://github.com/gkfeed/api/pull/7), v1 commit
  `393e7b4dab017df48a5d491ccccd5decbb3e35f4`.
- **Migration applied:** no. The database serving the running API has only
  `20260904184133`, `20260905082946`, `20260911093048`, `20260927071753` in
  `public.schema_migrations`. `20261012101552` is absent.
- **API deployed:** the browser-session release is not serving the public origin.
  Session routes return 404 and Swagger lacks them.
- **Runtime verified:** blocked. Password/passkey session issuance, cookie
  authentication against PostgreSQL, renewal and revocation remain unverified.

## Runtime and delivery chain

`feed.gws.freemyip.com` resolves to the inspected server. Its nginx configuration
proxies `/api/` unchanged to port 8086 and frontend requests to port 4200.
There is no Origin override or cookie rewrite in the inspected nginx config.
The public HTTPS origin serves the frontend and Swagger. HTTP is also served
without a redirect in these server blocks; production cookie checks must use HTTPS.
The separate HTTP `gkfeed.gws` virtual host points `/api/` to port 8000, not this
API, and is not verified as a supported cookie/passkey origin.

The running `api-v1-app-1` container was created on September 27 and started on
October 17. Image ID:
`sha256:891580c4daddcf98ce2ab98e5eaa53b467ef2c94f9cfa9fc59fb38ad65163244`.
It has no source-revision image label, so the exact image commit is not proven.
Its Compose working directory is `/home/ubuntu/github/gkfeed/api-v1`, whose clean
checkout is branch `v1`, commit `4fd7620bbc19f79d2c0e9cba91f82cfdb7f5928d`.
The configured remote uses the older `gkfeed/api-go.git` repository URL.

Current GitHub API `v1` is the merged commit above; `master` remains
`429411cb21946a1a480764fae94bcd744d3596a3`, 49 commits behind `v1`.
The latest Actions run after the merge is Dependency Graph, not deployment.
The last listed Deploy run is May 20 on old master.

The workflow in merged `v1` tests master pushes but deploys only on manual
`workflow_dispatch` with `cutover_ready=true`. It SSHes to
`github/gkfeed/api-go` and runs `make update`. That directory is absent on the
inspected runtime host; the live service is in `api-v1`. `make update` pulls the
server checkout's tracked branch, then rebuilds Compose. It does not check out
the workflow SHA or synchronize `v1` into `master`. Master also has an older
workflow without the cutover gate. An operator must resolve checkout, workflow
revision and target-directory alignment before deployment. A merge or a green
Dependency Graph run provides no delivery guarantee.

## Database evidence

Container inspection identifies the API target as database `gkfeed`, login role
`gkfeed_api_login`, host `postgres:5432` on `gkfeed-infra_default`. The database
container on that network is `gkfeed-infra-postgres-1`, PostgreSQL 17.10.
No connection password or full DSN was printed or saved.

Queries ran inside `BEGIN READ ONLY` against this database:

```sql
SELECT version FROM public.schema_migrations ORDER BY version;
SELECT to_regclass('public.browser_sessions');
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'browser_sessions'
ORDER BY ordinal_position;
SELECT c.oid::regclass,
       has_table_privilege('gkfeed_api', c.oid, 'SELECT'),
       has_table_privilege('gkfeed_api', c.oid, 'INSERT'),
       has_table_privilege('gkfeed_api', c.oid, 'UPDATE'),
       has_table_privilege('gkfeed_api', c.oid, 'DELETE')
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'browser_sessions';
```

`to_regclass` returned NULL; column and privilege queries returned zero rows.
Thus none of the five required columns or table grants can be confirmed.
`gkfeed_api_login` is a member of `gkfeed_api`. Both roles lack superuser,
create-database and create-role privileges. `SET LOCAL ROLE gkfeed_api_login`
also sees no `browser_sessions` relation. No user or session data was queried.

Server infra checkout is still master commit
`a609ab31e8f81df497d3301e9a6b1882c2cb7384`. It has an existing modified schema
dump and untracked `.local/`; these were left untouched.

## Endpoints and configuration

Public requests observed:

- `GET /api/v2/me`: 404, expected 401 after deployment.
- `POST /api/v2/sessions` with empty JSON and the public Origin: 404.
- `POST /api/v2/sessions/passkey/begin` with the public Origin: 404.
- `/api/swagger/doc.json`: 200, contains legacy `/api/v1/auth/me` but no new
  browser-session paths.
- Unauthenticated `GET /api/v1/list`, `/api/v2/feeds` and
  `/api/v2/items/sync`: 401. These responses do not prove cookie or DB access.

The running container has no `GKFEED_ALLOWED_ORIGINS`,
`GKFEED_WEBAUTHN_RP_ID` or `GKFEED_WEBAUTHN_RP_ORIGIN`. Its Compose environment
does not pass them through. The merged API Compose file also needs an operator
override or equivalent configuration to pass these variables into the container;
putting them only in a host `.env` will not forward them automatically.

OPTIONS probes return 204 globally. They expose Allow-Origin for
`http://localhost:4200`, but not the public HTTPS origin,
`http://127.0.0.1:4200`, `http://gkfeed.local:4200` or a foreign origin.
This is CORS evidence only, not proof of the new mutation Origin enforcement.
The merged API defaults contain localhost origins only. Configure exact public
and required development origins, including actual custom ports/LAN origins.
Do not replace or synthesize Origin in either proxy.

Passkey production configuration needs an RP ID valid for the public hostname
and RP origin `https://feed.gws.freemyip.com`. A localhost secure context alone
does not allow a passkey for the hosted domain: the API currently has one RP
origin setting. Local passkey E2E needs a compatible RP/domain configuration or
HTTPS test environment. HTTP LAN remains outside guaranteed WebAuthn support.

## Independent preparation in this draft

Both Vite API proxies now adapt only `gkfeed.session` on an actual HTTP
connection. They remove only Secure and retain HttpOnly, SameSite, Path,
Max-Age, Expires and clearing responses. Other cookies and HTTPS responses
are unchanged. Origin is forwarded unchanged. `make dev` still uses the hosted
API and requires no certificates or local Go process.

Unit tests cover cookie creation, clearing and unchanged HTTPS/unrelated
cookies. Chromium tests run a real Vite proxy against an isolated transport
fixture. They check HttpOnly visibility, persistence across reload, expiry,
browser cookie clearing, independent browser contexts, and preserved Origins.
These tests do not establish deployed password/passkey login, API session
revocation, PostgreSQL persistence or the production cookie attributes.

`make check` passed on this front branch: 150 Vitest files, 1,080 tests, ESLint,
TypeScript checks, production/BFF build and bundle budget, plus 70 Playwright
tests. Two existing viewport-specific cases were skipped by their iPhone-only
condition. The full run also logged one Vite `Unknown Error: [object Event]`
without a failed test; this is not evidence of a deployed integration check.

## Gate before the auth transition

1. An operator brings infra to the merged release and applies migration
   `20261012101552` to the API's actual database. Recheck all columns and
   SELECT/INSERT/UPDATE/DELETE under the API role, plus startup schema checks.
2. Resolve API deployment path/revision alignment and deploy the merged v1
   browser-session release with the existing cutover prerequisites satisfied.
   Pass exact allowed origins and WebAuthn settings into the actual container.
3. Recheck Swagger and `/me` 401, then use the user's browser session or an
   authorized test user to verify login, protected feeds/items, real cookie
   flags/expiry/renewal, Origin rejection, reload and logout. Check a second
   device session survives logout and PostgreSQL sessions survive API restart
   when an operator-authorized restart is available.
4. Continue the frontend implementation in this thread: user-only auth state,
   v2 password/passkey flow, `/me` restoration with loading/error states,
   DELETE logout, same-origin production `/api`, and one-time removal of legacy
   credentials without an automatic password exchange. Remove Basic headers
   from feed/item calls and update auth fixtures and regression tests.
5. Run the frontend checks and real password/passkey E2E where available.
   Keep this PR draft until the auth transition and its release dependencies
   are ready. Frontend production deployment remains a separate action.

The agreed [API contract](https://github.com/gkfeed/api/blob/393e7b4dab017df48a5d491ccccd5decbb3e35f4/docs/browser-sessions.md)
is authoritative. The older task proposing session ownership in the Node BFF
is superseded; Go API owns the sessions, while the public proxy forwards them.
