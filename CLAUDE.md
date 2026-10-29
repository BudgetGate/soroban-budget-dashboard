# CLAUDE.md — soroban-budget-dashboard

Scope: this repo only. If the workspace-level `CLAUDE.md` exists in the parent folder, read it as well. Where the two differ, this file wins for this repo. The defect table below was checked against `origin/main` (`180ebe0`) on 2026-10-29. Re-verify an item before relying on it.

## 1. What this repo is

The visualization layer of Budget Gate. A single-page React app deployed on Vercel at `budgetgate-dashboard.vercel.app`. It is meant to read the history of baseline snapshots from a Soroban contract repo through the GitHub API and chart how each function's CPU, read bytes, write bytes and footprint entries drift over commits. (Core records `memory_bytes` as `null` on current RPCs and no longer compares it, so the dashboard does not chart it.)

User docs live in the separate `BudgetGate/docs` site (budgetgate.github.io/docs/), which describes this repo as of `180ebe0` (each user-facing PR since D9 shipped with a matching docs PR), including its sample data and limitations. This repo has no docs pages of its own (D9 removed `docs/`, the `/docs` route and `DOCUMENTATION.md`); the app's READ DOCS button links to budgetgate.github.io/docs/dashboard/. A PR here that changes what the app shows or how it loads data needs a matching docs PR, linked from both descriptions.

It has no backend and no database. Everything it shows must come from GitHub or from clearly labeled sample data.

Boundaries:
- No dependency on `soroban-budget-action`.
- It consumes snapshots shaped by `soroban-budget-core`'s `SCHEMA.md`. It never defines or changes that schema.
- It never presents sample or invented numbers as real measurements.

## 2. Known layout

Layout last checked in full against `main` `4fdd186` on 2026-10-26; later PRs (through #33, `180ebe0`, 2026-10-29) updated the rows they changed. `package.json` name `soroban-budget-dashboard` (D1, 2026-10-27). `type: module`, private.

| Item | Detail (read unless stated) |
|------|--------|
| App stack | React 19, Vite 8 (`@vitejs/plugin-react`), TypeScript ~6.0, Tailwind 4 (`@tailwindcss/vite`), `react-router-dom` 7, `recharts` 3, `@octokit/rest` 22, `lucide-react` |
| `src/App.tsx` | One route: `/` → `Dashboard`. |
| `src/api.ts` | `SnapshotFunction`/`Snapshot`/`SnapshotHistory` types (schema 2.0 fields: `memory_bytes: number | null`, optional `read_entries`/`write_entries` that may be `null`). `fetchSnapshotHistory(url)`: no URL → hardcoded `MOCK_HISTORY` after 500 ms (the page labels it "Sample data"); `github://owner/repo/ref/path` → unauthenticated Octokit `getContent` with the raw media type (`mediaType: { format: 'raw' }`, D17), so the file arrives as a string at any size up to GitHub's 100 MB; otherwise `fetch(url)`. Every path goes through `parseHistory`: an object with a `snapshots` array, each snapshot an object with `schema_version` in `SUPPORTED_SCHEMA_VERSIONS` (`1.0`, `2.0`, as core reads) and a `functions` array; anything else throws a message naming the snapshot and commit. `rateLimitFrom` turns a 403/429 into a `RateLimitError` (with `retryAt`) when `x-ratelimit-remaining` is `0` (reset from `x-ratelimit-reset`), `retry-after` is set, it is a 429, or the message names a rate limit, per GitHub's REST rate-limit docs; any other 403 stays a plain error. api.github.com exposes these headers to browsers (`Access-Control-Expose-Headers`, checked 2026-10-27). `github://` results are kept per URL until the response's `Cache-Control` `max-age` (`maxAgeSeconds`; 60 s on the Contents API) runs out, since unauthenticated 304s still cost quota (checked 2026-10-28); `githubFetchInfo` gives the fetch time and freshness for the page; failed or invalid reads are not kept; `clearGithubCache` is for tests. `https://` sources rely on the browser's HTTP cache. No retry. |
| `src/pages/Dashboard.tsx` | ~300 lines. Data-source URL input, stat panels (latest commit, regression state, tracked functions), the `TrendAlerts` panel, function selector, three `MetricChart`s (CPU instructions; read/write bytes; all/read-write footprint entries), each with its unit on the y-axis and the second series dashed, a refresh counter so applying the same URL reloads, a "Fetched from GitHub at …" line (`role="status"`) for `github://` sources, then `FunctionsTable` (all functions selected) or `FunctionHistoryTable` (one selected), a single-commit >10% CPU jump check, and a "Sample data" note (`role="note"`) whenever no data-source URL is applied. No demo button (removed in D4). Props passed to the charts and tables stay identical while the URL is typed (D15). |
| `src/metrics.ts` | `uniqueFunction`: a snapshot's entry for a name only when the name appears once (core before v0.2.3 accepted repeated names; such a snapshot counts as unmeasured for that function everywhere: charts, history rows with `repeated`, trends, the regression card). `metricValue`/`toChartPoints`: a metric per snapshot for one function or the sum over all (repeated entries included in the sum). `null` when the function is missing or repeated, or any value is unreported; a sum is never taken over a partial set. Memory is not charted (core records it as `null`). `functionHistory`: one `FunctionRow` per snapshot for one function (values, % change against the last snapshot that contained it, `null` from a previous 0 or an unknown value; `pct_of_network_cap` 0 read as not recorded). `functionSummaries`: each function's latest measurement, latest-snapshot functions first, others flagged as not in the latest snapshot. |
| `src/components/MetricChart.tsx` | One Recharts step-line chart per unit. Says "Not reported in these snapshots" instead of drawing an empty chart. |
| `src/trends.ts` | Trend rules (maintainer's decision, 2026-10-28), constants matching core's flag defaults: cap projection (least-squares slope of `pct_of_network_cap` over the last `CAP_WINDOW` = 5 measurements, flagged when it reaches `CAP_WARNING_PCT` = 80 within `CAP_HORIZON_COMMITS` = 10 commits or is already there; skipped when any of the 5 has no cap figure) and creep (a metric rose in each of the last `CREEP_RISES` = 3 measurements and by `CREEP_TOTAL_PCT` = 10% or more). `findTrends` covers functions in the latest snapshot only; `capRuleApplies` says whether any function has the data for the cap rule. |
| `src/components/TrendAlerts.tsx` | The "Trend alerts" panel above the charts: each alert with its numbers and a button that opens the function's history, or "No function is trending…", then the rules, and a note when the cap rule has too little data. |
| `src/components/FunctionTables.tsx` | The per-function drill-down: `FunctionsTable` (latest measurement per function, each row opens its history) and `FunctionHistoryTable` (one row per snapshot, newest first, "All functions" back button). The sign of a change carries its direction; color only repeats it. Tables scroll inside their box on narrow screens. |
| `index.html` | `<title>Budget Gate dashboard</title>`. |
| Tests | `src/App.test.tsx`, `src/metrics.test.ts`, `src/trends.test.ts`, `src/api.test.ts`, Vitest 5 + jsdom (jest-dom matchers through `@testing-library/jest-dom/vitest`) + Testing Library, 107 tests in all (repeated names: `metricValue`, `functionHistory`, `functionSummaries` and `findTrends` cases): GitHub read reuse (within and after max-age, no max-age, per URL, invalid not kept) and table-driven `maxAgeSeconds`, refresh with the same URL and the fetch-time line, table-driven `slope`, cap-projection, creep and `capRuleApplies` cases (horizon edges, exactly 10%, dips, flat steps, too few measurements, pre-cap snapshots, windows, gaps, removed functions), the Trend alerts panel (creep the single-commit card misses, a cap projection, the empty and too-little-data messages, opening a history), loading, error, rate-limited (with retry time), empty history, the Sample data note (shown with no URL, gone once a URL is applied; no demo button), loaded history with the function filter, the three charts with entries shown as not reported, the 10% CPU regression threshold on both sides, chart renders while typing (D15), the drill-down (functions table order, changes and "not reported"/"not recorded", opening a history from the table and from the filter, back to all functions, a function missing from a snapshot, an empty commit SHA), and table-driven `metricValue`, `functionHistory` and `functionSummaries` cases (sum, selection, missing function, `null`/absent values, partial sums, real zeros, changes across a gap, no change from 0), and in `api.test.ts` table-driven `parseHistory` and `rateLimitFrom` cases plus `fetchSnapshotHistory` over a stubbed `fetch` and a mocked Octokit (rate limit, other HTTP errors, unknown version, a GitHub file read). `fetchSnapshotHistory` is mocked with typed `Snapshot` data (no `any`); `npm run build` type-checks this file. |
| Lint | Oxlint, config in `.oxlintrc.json`. Passes. |
| `.github/workflows/ci.yml` | `Dashboard CI`, job `build`: `npm ci`, `npm run lint`, `npm test`, `npm run build`. Node 24, `actions/checkout@v7`, `setup-node@v7` (both `node24`). Runs on push/PR to `main` only. |
| `.github/dependabot.yml`, `.github/workflows/audit.yml` | Dependency hygiene (2026-10-29, audit item 3): Dependabot opens weekly PRs for npm (runtime and development minor/patch updates grouped) and GitHub Actions; `Audit` runs weekly (Monday 06:17 UTC), on demand and on every PR to `main` (Phase 9 item 9; before, only PRs that changed it): `npm audit --omit=dev` (any finding fails) and `npm audit --audit-level=moderate`. Not a required check. |
| Config | `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`. `dist/` is gitignored. |
| Other | `CONTRIBUTING.md` (Node 24 setup, `npm ci`/lint/test/build, the rules in section 6, PR checklist), `SECURITY.md` (reports through GitHub private vulnerability reporting, which the maintainer must enable in the repo settings; states the project is unaudited and not production-ready). |

Scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview`, `test` (`vitest run`).

## 3. Known defects

Checked 2026-10-29 against `origin/main` (`180ebe0`): no open defects; `npm audit` 0.

| ID | Defect | Evidence |
|----|--------|----------|

Resolved and removed, latest first: D18 (found in the workspace audit, 2026-10-29): `npm audit` reported 6 issues (4 high): `vite` 8.2.0 (dev-server advisories, `launch-editor`), `nanoid` 3.3.17 and `source-map-js` 1.2.1 (via `postcss`, `@tailwindcss/vite`), `undici` 7.29.0 (via `jsdom`), and `vitest`/`@vitest/mocker` 4.1.10. All are build, dev-server or test tools; none is in the browser bundle. Fixed in the lockfile only, within the existing `package.json` ranges: `vite` 8.3.5, `nanoid` 3.3.20, `source-map-js` 1.2.2, `postcss` 8.5.32, `undici` 7.30.1, `vitest` 4.1.12; `npm audit` reports 0. `esbuild` left the lockfile: it is only an optional peer of `vite` and this config does not use it. npm 10.9.2 crashes on `npm audit fix` here (`Cannot read properties of null (reading 'edgesOut')`, in arborist's peer-set code); the lockfile was written with npm 11.6.2 (CI's Node 24 ships npm 11), and `npm ci` accepts it on npm 10. The production build renders the same as `main`'s in headless Chrome (sample data, the test repo's history by raw URL and `github://`; no console errors). D17 (found 2026-10-28 while planning GitHub caching): `github://` read files through the Contents API's default JSON form, which leaves `content` empty (`encoding: "none"`) for files over 1 MB (checked on a 2.4 MB public file), so the page failed with "Not a valid file". At about 220 bytes per function entry and the Action's 200-snapshot cap, a contract with roughly 23 or more functions would reach that. Fixed by requesting the raw media type; checked in headless Chrome: the real test-repo history loads, and the 2.4 MB file arrives (then fails as not JSON, as it should) where the live site said "Not a valid file". D16 (found 2026-10-28): `SECURITY.md` sent reports to `security@budgetgate.io`, but `budgetgate.io` does not exist (NXDOMAIN on Google DNS), so reports could not arrive and whoever registered the domain would receive them. It now points to GitHub private vulnerability reporting (maintainer's decision); that was off on 2026-10-28 and has to be enabled in the repo settings. D15 (found 2026-10-28 in a browser check of the live site, fixed in #20): typing a data-source URL key by key crashed the whole page after about 30 characters with React error #185 (maximum update depth), in production builds only; pasting did not. Each keystroke re-rendered all three Recharts charts with new `series` arrays. `MetricChart` is now `memo`ized and the series are module constants, so typing no longer re-renders the charts; `App.test.tsx` counts chart renders while typing (140 without the fix, 2 with it). The exact mechanism inside Recharts 3.10 was not pinned down: switching the function filter 60 times, which re-renders the charts with new data, never crashed.

## 4. Work order for this repo

1. No roadmap items left (2026-10-29). Done: per-function drill-down, trend alerting, large GitHub files (D17), and caching with a refresh that reloads (checked locally and live). Pagination was dropped (one `history.json`, at most 200 snapshots). New work starts from a new defect or a maintainer request.

`roadmap.md` tracks progress against this list.

## 5. Commands

```
npm ci
npm run dev
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm test            # vitest run
```
Run on 2026-10-29 on `180ebe0` (Linux, Node 22): `npm run lint` exits 0, `npm test` 101 of 101 pass, `npm run build` passes with a chunk-size warning. The production build and the live site were opened in headless Chrome the same day (D18). `npm run dev` was not run.

## 6. Rules

### Data and honesty
- Sample data is allowed only when the UI says "Sample data" next to it. Never render invented numbers as measurements.
- Validate the snapshot `schema_version` on load. On an unknown version, show a clear error. Do not guess.
- Show loading, empty, rate-limited and error states. A blank chart is not an error state.

### App conventions
- `strict` TypeScript. No `any` without a comment explaining why.
- Anything in `VITE_*` environment variables ships to the browser. Never put a token there.
- User docs live in `BudgetGate/docs`. Do not add docs pages, a docs route or a docs site to this repo (D9 removed them). README, `CONTRIBUTING.md` and `SECURITY.md` stay here.
- Charts must be readable without color alone and labeled with units.
- Add a dependency only after checking that the existing stack cannot do the job.

### Commit and PR conventions
These are the maintainer's rules and override default tool attribution.
- Never add "Co-Authored-By" lines to git commits.
- Do not include Claude attribution or footers in commit messages or pull request descriptions.
- Keep commit messages concise, starting with an imperative verb (e.g., "Fix bug", "Add feature").

### Git
- Never `git add .` or `git add -A`. Stage named files only.
- One logical unit per commit. Work on a branch, push after every commit, open a PR. No pushes to `main`, no force-push.
- Do not change Vercel project settings or repo settings. Report what needs changing.
- Do not create tags or releases unless asked.

### Code style and behavior
- Write clean, idiomatic code matching the existing style of the repository.
- Avoid introducing speculative features or unused dependencies.
- Do not add conversational filler (e.g., "Sure, I can help with that!") inside code comments.
- Fix what was asked. List nearby problems in your report instead of fixing them in the same PR.

## 7. Done means

- [ ] `npm run lint`, `npm test` and `npm run build` pass
- [ ] You opened the page in a browser (`npm run dev` or the deployed URL) and looked at it. A green build is not enough
- [ ] After a deploy, the live page title and content changed, checked in the browser
- [ ] The report lists what you ran, what you saw, and what you did not verify

## 8. Keeping this file honest

When you fix a defect, delete its row in the same PR. When you find a new one, add a row with evidence. The workspace `CLAUDE.md` carries a copy of these rows. This file is authoritative for this repo. Update the workspace copy when you can.
