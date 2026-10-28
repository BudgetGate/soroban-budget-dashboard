# CLAUDE.md — soroban-budget-dashboard

Scope: this repo only. If the workspace-level `CLAUDE.md` exists in the parent folder, read it as well. Where the two differ, this file wins for this repo. The defect table below was checked against `origin/main` (`4fdd186`) on 2026-10-26. Re-verify an item before relying on it.

## 1. What this repo is

The visualization layer of Budget Gate. A single-page React app deployed on Vercel at `budgetgate-dashboard.vercel.app`. It is meant to read the history of baseline snapshots from a Soroban contract repo through the GitHub API and chart how each function's CPU, read bytes, write bytes and footprint entries drift over commits. (Core records `memory_bytes` as `null` on current RPCs and no longer compares it, so the dashboard does not chart it.)

User docs live in the separate `BudgetGate/docs` site (budgetgate.github.io/docs/), which describes this repo as of `4fdd186`, including its sample data and limitations. This repo has no docs pages of its own (D9 removed `docs/`, the `/docs` route and `DOCUMENTATION.md`); the app's READ DOCS button links to budgetgate.github.io/docs/dashboard/. A PR here that changes what the app shows or how it loads data needs a matching docs PR, linked from both descriptions.

It has no backend and no database. Everything it shows must come from GitHub or from clearly labeled sample data.

Boundaries:
- No dependency on `soroban-budget-action`.
- It consumes snapshots shaped by `soroban-budget-core`'s `SCHEMA.md`. It never defines or changes that schema.
- It never presents sample or invented numbers as real measurements.

## 2. Known layout

State of `main` (`4fdd186`) on 2026-10-26. `package.json` name `soroban-budget-dashboard` (D1, 2026-10-27). `type: module`, private.

| Item | Detail (read unless stated) |
|------|--------|
| App stack | React 19, Vite 8 (`@vitejs/plugin-react`), TypeScript ~6.0, Tailwind 4 (`@tailwindcss/vite`), `react-router-dom` 7, `recharts` 3, `@octokit/rest` 22, `lucide-react` |
| `src/App.tsx` | One route: `/` → `Dashboard`. |
| `src/api.ts` | `SnapshotFunction`/`Snapshot`/`SnapshotHistory` types (schema 2.0 fields: `memory_bytes: number | null`, optional `read_entries`/`write_entries` that may be `null`). `fetchSnapshotHistory(url)`: no URL → hardcoded `MOCK_HISTORY` after 500 ms (the page labels it "Sample data"); `github://owner/repo/ref/path` → unauthenticated Octokit `getContent`; otherwise `fetch(url)`. Every path goes through `parseHistory`: an object with a `snapshots` array, each snapshot an object with `schema_version` in `SUPPORTED_SCHEMA_VERSIONS` (`1.0`, `2.0`, as core reads) and a `functions` array; anything else throws a message naming the snapshot and commit. `rateLimitFrom` turns a 403/429 into a `RateLimitError` (with `retryAt`) when `x-ratelimit-remaining` is `0` (reset from `x-ratelimit-reset`), `retry-after` is set, it is a 429, or the message names a rate limit, per GitHub's REST rate-limit docs; any other 403 stays a plain error. api.github.com exposes these headers to browsers (`Access-Control-Expose-Headers`, checked 2026-10-27). No caching or retry. |
| `src/pages/Dashboard.tsx` | ~450 lines. Data-source URL input, stat panels (latest commit, regression state, tracked functions), function selector, three `MetricChart`s (CPU instructions; read/write bytes; all/read-write footprint entries), each with its unit on the y-axis and the second series dashed, a single-commit >10% CPU jump check, and a "Sample data" note (`role="note"`) whenever no data-source URL is applied. No demo button (removed in D4). |
| `src/metrics.ts` | `metricValue`/`toChartPoints`: a metric per snapshot for one function or the sum over all. `null` when the function is missing or any value is unreported; a sum is never taken over a partial set. Memory is not charted (core records it as `null`). |
| `src/components/MetricChart.tsx` | One Recharts step-line chart per unit. Says "Not reported in these snapshots" instead of drawing an empty chart. |
| `index.html` | `<title>Budget Gate dashboard</title>`. |
| Tests | `src/App.test.tsx`, `src/metrics.test.ts`, `src/api.test.ts`, Vitest 4 + jsdom + Testing Library, 42 tests in all: loading, error, rate-limited (with retry time), empty history, the Sample data note (shown with no URL, gone once a URL is applied; no demo button), loaded history with the function filter, the three charts with entries shown as not reported, the 10% CPU regression threshold on both sides, and table-driven `metricValue` cases (sum, selection, missing function, `null`/absent values, partial sums, real zeros), and in `api.test.ts` table-driven `parseHistory` and `rateLimitFrom` cases plus `fetchSnapshotHistory` over a stubbed `fetch` and a mocked Octokit (rate limit, other HTTP errors, unknown version, a GitHub file read). `fetchSnapshotHistory` is mocked with typed `Snapshot` data (no `any`); `npm run build` type-checks this file. |
| Lint | Oxlint, config in `.oxlintrc.json`. Passes. |
| `.github/workflows/ci.yml` | `Dashboard CI`, job `build`: `npm ci`, `npm run lint`, `npm test`, `npm run build`. Node 24, `actions/checkout@v7`, `setup-node@v7` (both `node24`). Runs on push/PR to `main` only. |
| Config | `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`. `dist/` is gitignored. |
| Other | `CONTRIBUTING.md` (Node 24 setup, `npm ci`/lint/test/build, the rules in section 6, PR checklist), `SECURITY.md` (reporting address `security@budgetgate.io`, not checked to be deliverable; states the project is unaudited). |

Scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview`, `test` (`vitest run`).

## 3. Known defects

Checked 2026-10-26 against `origin/main` (`4fdd186`).

| ID | Defect | Evidence |
|----|--------|----------|

## 4. Work order for this repo

1. Per-function drill-down and trend alerting once real data flows.

`roadmap.md` tracks progress against this list.

## 5. Commands

```
npm ci
npm run dev
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm test            # vitest run
```
Run on 2026-10-27 after D6 (Linux, Node 22): `npm run lint` passes (exit 0, no warnings), `npm run build` passes with a chunk-size warning, `npm test` 6 of 6 pass. `dev` was not run, and the page was not opened in a browser.

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
