# CLAUDE.md — soroban-budget-dashboard

Scope: this repo only. If the workspace-level `CLAUDE.md` exists in the parent folder, read it as well. Where the two differ, this file wins for this repo. The defect table below was checked against `origin/main` on 2026-10-26. Re-verify an item before relying on it.

## 1. What this repo is

The visualization layer of Budget Gate. A single-page React app deployed on Vercel at `budgetgate-dashboard.vercel.app`. It is meant to read the history of baseline snapshots from a Soroban contract repo through the GitHub API and chart how each function's CPU, read bytes, write bytes and footprint entries drift over commits. (Core records `memory_bytes` as `null` on current RPCs and stops comparing it once core PR #9 lands; see D7.)

It has no backend and no database. Everything it shows must come from GitHub or from clearly labeled sample data.

Boundaries:
- No dependency on `soroban-budget-action`.
- It consumes snapshots shaped by `soroban-budget-core`'s `SCHEMA.md`. It never defines or changes that schema.
- It never presents sample or invented numbers as real measurements.

## 2. Known layout

State of `main` on 2026-10-26. `package.json` name is still `temp_vite` (D1). `type: module`, private.

| Item | Detail (read unless stated) |
|------|--------|
| App stack | React 19, Vite 8 (`@vitejs/plugin-react`), TypeScript ~6.0, Tailwind 4 (`@tailwindcss/vite`), `react-router-dom` 7, `recharts` 3, `@octokit/rest` 22, `lucide-react`, `react-markdown` |
| `src/App.tsx` | Two routes: `/` → `Dashboard`, `/docs` → `Docs`. |
| `src/api.ts` | `SnapshotFunction`/`Snapshot`/`SnapshotHistory` types (schema 1.0 fields, `memory_bytes: number`). `fetchSnapshotHistory(url)`: no URL → hardcoded `MOCK_HISTORY` after 500 ms; `github://owner/repo/ref/path` → unauthenticated Octokit `getContent`; otherwise `fetch(url)`. No `schema_version` check, no 403/429 handling. |
| `src/pages/Dashboard.tsx` | ~450 lines. Data-source URL input, stat panels (latest commit, regression state, tracked functions), function selector, Recharts line chart of CPU and memory, a single-commit >10% CPU jump check, and a "demo" button that appends a fake snapshot (+25% CPU, +15% memory). |
| `src/pages/Docs.tsx` | Renders the repo's `DOCUMENTATION.md` with `react-markdown`. |
| `index.html` | `<title>temp_vite</title>`. |
| Tests | `src/App.test.tsx`, Vitest 4 + jsdom + Testing Library, 3 tests, all failing (D6). |
| Lint | Oxlint, config in `.oxlintrc.json`. Passes. |
| Docs site | VitePress 1.x, content in `docs/` (`index.md`, `guide/{index,getting-started,architecture}.md`). The `vue` dev dependency exists only for VitePress. Where the docs are deployed is unknown. A separate VitePress site also exists in the `BudgetGate/docs` repo. |
| `.github/workflows/ci.yml` | `Dashboard CI`, job `build`: `npm ci`, `npm run build`. Does not run lint or tests. Runs on push/PR to `main` only. |
| Config | `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`. `dist/` is gitignored. |
| Other | `DOCUMENTATION.md` (rendered at `/docs`), `PR_BODY.md`, `CONTRIBUTING.md`, `SECURITY.md`. `PR_BODY.md` not reviewed. |

Scripts: `dev`, `build` (`tsc -b && vite build`), `lint` (`oxlint`), `preview`, `test` (`vitest run`), `docs:dev`, `docs:build`, `docs:preview`.

## 3. Known defects

Checked 2026-10-26 against `origin/main`.

| ID | Defect | Evidence |
|----|--------|----------|
| D1 | Package name and page `<title>` are `temp_vite`. The live page at budgetgate-dashboard.vercel.app also has title `temp_vite`. | `package.json`, `index.html:7`, live fetch |
| D2 | README was rewritten (not the Vite template any more) but describes Memory as a tracked metric and a "cyberpunk" UI; check it against the app once D3 is done. | `README.md` |
| D3 | What the deployed app renders was not checked in a browser. | — |
| D4 | With no data-source URL it silently shows hardcoded `MOCK_HISTORY`, not labelled as sample data. The "demo" button appends invented snapshots to the chart. Both break the "never present sample numbers as real" rule. | `src/api.ts:24,85`, `src/pages/Dashboard.tsx:80-100` |
| D5 | Open design question: how data gets in. Unauthenticated GitHub REST calls from a browser are rate-limited, a token must never be bundled, and nothing in the pipeline produces the `history.json` the app expects (core writes one snapshot; the Action puts it in the Actions cache). Do not pick silently. | `src/api.ts`, design |
| D6 | All 3 Vitest tests fail: they look for text that no longer exists ("Fetching telemetry data", "Error Fetching Data", "Resource Consumption"). CI runs only `npm run build`, so it stays green. | `npm test`, `.github/workflows/ci.yml` |
| D7 | Only CPU and memory are charted; read and write bytes are never shown. Core now records `memory_bytes: null` (and stops comparing memory once core PR #9 lands); the aggregate view would sum `null` as 0. | `src/pages/Dashboard.tsx`, core `SCHEMA.md` |
| D8 | No `schema_version` validation on load, no handling of 403/429 rate limits. | `src/api.ts` |

## 4. Work order for this repo

1. D3: open the live app and `npm run dev` in a browser; record what you see.
2. D6: make the tests describe the current UI; add `npm run lint` and `npm test` to CI.
3. D1, D4: real package name and title (regenerate `package-lock.json` after renaming); label sample data as "Sample data" in the UI, remove the fake demo snapshots.
4. D7, D8: chart CPU, read bytes, write bytes (and footprint entries once core #9 lands); validate `schema_version`; handle `null` metrics.
5. D5: decide the data source with the maintainer. Then wire GitHub reading, pagination and caching, and visible 403/429 handling.
6. D2: README matches the app. Then per-function drill-down and trend alerting once real data flows.

`roadmap.md` tracks progress against this list.

## 5. Commands

```
npm ci
npm run dev
npm run build       # tsc -b && vite build
npm run lint        # oxlint
npm test            # vitest run
npm run docs:dev    # VitePress
npm run docs:build
```
`npm run lint` (passes), `npm run build` (passes, chunk-size warning) and `npm test` (3 of 3 fail, D6) were run on 2026-10-26. `dev` and the `docs:*` scripts were not run.

## 6. Rules

### Data and honesty
- Sample data is allowed only when the UI says "Sample data" next to it. Never render invented numbers as measurements.
- Validate the snapshot `schema_version` on load. On an unknown version, show a clear error. Do not guess.
- Show loading, empty, rate-limited and error states. A blank chart is not an error state.

### App conventions
- `strict` TypeScript. No `any` without a comment explaining why.
- Anything in `VITE_*` environment variables ships to the browser. Never put a token there.
- Do not write app code in Vue. It is a VitePress dependency only.
- Docs live in `docs/` (VitePress). Do not start a second docs site.
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
