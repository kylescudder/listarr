# Production application end-to-end tests

Run with Bun 1.4.4, after `bun install --frozen-lockfile`:

```sh
bunx --no-install playwright install chromium
E2E_EVIDENCE=1 bun run test:e2e
```

The existing harness builds the real TanStack Start application and serves its
production output through `server/production.ts`. Playwright drives the real UI
and calls its HTTP API. No application routes, React components, authorization
functions or storage implementation are mocked. The server process substitutes
only outbound TMDB and Radarr fetches. Unexpected outbound hosts throw, and all
service credentials, origins and Clerk verification keys are replaced in the child
environment. No real Radarr writes, deployment, live service restart or UDMS
integration is involved. A free loopback port isolates concurrent worktrees.

Browser contexts start empty for each test. The two damaged-draft tests deliberately
write corrupt browser storage as their input; persistence tests otherwise pick
through the actual UI. Fixture films have no posters, exercising the app's real
placeholder rendering without live image traffic. TMDB pages contain distinct
films; discovery fixtures match all three upstream filter values. Text-search
fixtures reject leaked discovery parameters. People fixtures include cast, crew,
a repeated credit and an adult result to check merge, deduplication and exclusion.

Radarr fixtures include a monitored film with no file, mixed into discovery,
search, subsequent pages, credits and collection results. A collection containing
only that film verifies the filtered empty state. `tests/radarr.test.ts` also checks
fresh library membership, downloaded/unmonitored films, optional configuration,
URL bases and rejected/unreachable/malformed Radarr responses at the API boundary.

## Coverage

| Journey                              | Automated checks                                                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop and mobile browsing          | Initial results, search, empty results, previous/next bounds, distinct page content, responsive overflow check                                                                                 |
| People / collections / discovery     | Expand people and collection results, cast + crew, duplicate/adult exclusion, genre + year + sort propagated to upstream, discovery filters ignored for text searches                          |
| Picking and limits                   | Add/remove from cards and programme, 100 real UI picks, reject 101st across pages, remove then replace, reload all 100, export exact IDs                                                       |
| Drafts and validation                | Name and picks survive reload, removal survives reload, malformed JSON and invalid IDs recover, empty selection disables export/create, blank name disables create                             |
| Optional Clerk / snapshot URL        | No Clerk key required to browse/pick/export, direct-create explanation, sorted public feed, deduplicated IDs, old URL immutable after draft edits, malformed and oversized feeds rejected      |
| Allowed direct creation (HTTP)       | Real Clerk verifier with throwaway RSA signature and allowed subject; safe Radarr payload checked by upstream fixture; resulting URL is anonymously readable                                   |
| Denied direct creation (HTTP)        | Missing/invalid/tampered/expired token, denied user, wrong request origin and JWT authorised party; invalid name/IDs/size                                                                      |
| Duplicate creation / recovery (HTTP) | Same selection, reordered/duplicate IDs and renamed draft return existing list; simultaneous identical requests create once; failed Radarr POST followed by successful retry of same selection |
| Upstream failure / recovery          | Empty search, TMDB 503 and 429, successful subsequent search; real Try again button recovers transient 503 without losing picks; Radarr rejection gives 502 and queue remains usable           |

API-only cases run once in the desktop project: repeating them under a mobile
viewport adds no coverage. UI cases run in both Chromium projects. Tests have no
retries; failures remain failures. CI forbids focused tests.

## Evidence and provenance

`artifacts/full-e2e/` (ignored) contains `run.log` in CI, `provenance.json`,
`results.json`, generated `evidence.md`, and a per-test PNG publishing inventory.
`playwright-report/` contains the HTML report; `test-results/` contains screenshots,
recordings and failure traces. CI always uploads all three directories as
`playwright-evidence` for seven days, even on failure. `E2E_EVIDENCE=1` retains
successful videos too; screenshots always remain. The harness records source SHA,
dirty state, time, Bun version, boundary scope and actual allocated origin without
logging signing keys. Do not publish token headers or raw auth storage.

Attach inspected PNGs and relevant recordings to the Listarr PR using `gh`'s
`--attach`; relative image references in generated `evidence.md` are rewritten to
GitHub URLs. The HTML report and CI artifact are complementary to viewable PR
attachments. Generated inventory is not a claim of visual inspection.

## Deliberate gaps

- Real Clerk sign-in, Clerk-enabled account UI, modal interaction, token refresh,
  and browser creation success/error notices require a disposable Clerk tenant.
  No production login is used or faked. Signed JWT API coverage verifies the actual
  server authorization boundary, not an interactive authentication journey.
- Live TMDB data/posters, real Radarr compatibility, sync/download behavior,
  deployment networking and reverse-proxy authentication are not exercised.
- Mobile is a Chromium viewport, not physical-device or iOS Safari coverage.
- Network timeouts, malformed upstream JSON, missing Radarr schema/configuration,
  an empty operator allowlist, clipboard denial, browser storage quota denial and
  cross-tab draft behavior are not currently covered by this suite.
- No database exists in Listarr; database provisioning or migration tests do not apply.
