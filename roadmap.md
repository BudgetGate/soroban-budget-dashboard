# soroban-budget-dashboard roadmap

Progress tracker for this repo. The defect IDs (D1, D2, …) and their evidence are in `CLAUDE.md` section 3; the order comes from `CLAUDE.md` section 4. Tick a box only when the change is merged to `main` and, for UI changes, checked in a browser.

Last updated: 2026-10-28

## Where I left off

- `main` is at `460abf3` (after #20). Lint, tests (43 after D15) and build pass.
- D9 done: `docs/`, the `docs:*` scripts, `vitepress`, `vue`, `react-markdown` (only `Docs.tsx` used it), the `/docs` route, `Docs.tsx` and `DOCUMENTATION.md` are gone. READ DOCS links to budgetgate.github.io/docs/dashboard/; the EXTERNAL DOCS button (pointing at the stale Vercel copy) is removed.
- Found during D9: `docs/` was deployed after all, by a second Vercel project `budgetgate-docs` (D11). The maintainer deleted that project on 2026-10-27; budgetgate-docs.vercel.app now returns `DEPLOYMENT_NOT_FOUND`, and commits get only the app's `Vercel` status.
- D6 done: the 6 tests describe the current UI and pass; CI runs lint and tests before the build.
- D12 done: CI runs on Node 24 with `actions/checkout@v7` and `setup-node@v7`, so it no longer warns about Node 20.
- D10 done: `CONTRIBUTING.md` describes this repo (Node 24, `npm ci`, lint, test, build, the section 6 rules, PR checklist) instead of core's Go guide.
- D7 done: three charts (CPU instructions; read/write bytes; footprint entries), units on the axes, dashed second series, memory dropped, unknown values drawn as gaps instead of 0. Checked in headless Chrome against `npm run dev` with sample data and with a two-snapshot history measured by core on testnet (counter v1 → v2).
- D8 done: every history is checked before use (shape, `schema_version` `1.0`/`2.0`, `functions` array) with an error naming the snapshot; a 403/429 that GitHub's rules mark as a rate limit shows a RATE_LIMITED screen with the retry time. Checked in headless Chrome: real history, a `3.0` snapshot, a local 403 with `x-ratelimit-remaining: 0`, and a real `github://` read of a non-history file.
- D3 done (2026-10-27): headless Chrome against budgetgate-dashboard.vercel.app, which serves `b6e4134` (its JS bundle contains the D7/D8 strings). What renders:
  - Title `temp_vite` (D1). Header: SYS.BUDGETGATE, "SOROBAN RESOURCE MONITOR_V2.0", READ DOCS (→ budgetgate.github.io/docs/dashboard/), RUN DEMO BUDGET TEST, the DATASOURCE_URL box, and a pulsing TESTNET_SYNC_ACTIVE badge on wide screens (D13).
  - It opens on the built-in sample, with no label (D4): 5 snapshots `a1b2c3d`…`e5f6g7h`, 2 functions (mint, transfer), "Clear", GEN_TIME 8/6/2026.
  - Telemetry guide cards for CPU, bytes and entries. CPU and bytes charts draw; entries say "Not reported in these snapshots".
  - The function filter switches to one function. The demo button plays a scripted terminal log imitating core, then adds commit `d3m0b4d…` and shows "Regression Detected" (D4).
  - At 390 px: everything stacks, no sideways scroll, charts readable, but the heading is clipped to "SYS.BUDGETGA" (D14).
  - No console errors or warnings and no failed requests.
  - `npm run dev` was checked the same way during D7 and D8.
- D1, D4 and D13 done in one PR: package `soroban-budget-dashboard`, title "Budget Gate dashboard" (lockfile changed only in its two `name` fields; `npm ci` accepts it); a "Sample data" note whenever the built-in history is shown; the demo button, its scripted terminal and fake snapshots, and the TESTNET_SYNC_ACTIVE badge are gone. Checked in headless Chrome on `npm run dev` at 1280 and 390 px, and with the real counter history (note gone, title kept).
- Live site checked after #15 deployed (headless Chrome, 320/390/768/1280 px): title "Budget Gate dashboard", Sample data note shown, no demo button, no TESTNET_SYNC_ACTIVE badge.
- D14 done: below `md` the heading is 24 px with `tracking-wider` and may wrap; from `md` up it keeps 30 px/`tracking-widest` and does not shrink. Measured on `npm run dev`: right edge 349 px inside a 350 px box at 390 px (one line), wraps to two lines at 320 px, one line at 768 and 1280 px.
- D2 done: README rewritten against the app and the D3/D4/D7/D8 behaviour: what it shows, the `https://` and `github://` sources, the Sample data note, the three charts, the CPU-only 10% regression card, errors and RATE_LIMITED, the missing history producer, Node 24 and `npm ci`, Vercel previews and deploys; links checked (all 200). Dropped: Memory as a metric, "stores", "Cyberpunk UI", the claim that the Action commits history the app reads, Node 18+, yarn, the broken `../CONTRIBUTING.md` link and the nonexistent code of conduct.
- `PR_BODY.md` removed: a stale description of the Octokit PR that nothing referenced.
- D5 done: the data source is the Action's history branch, read from raw.githubusercontent.com (`access-control-allow-origin: *`, checked 2026-10-28). README updated. Seen end to end on 2026-10-28: the live site, given `https://raw.githubusercontent.com/BudgetGate/budgetgate-action-test/budgetgate-history/history.json` (two snapshots the Action wrote, commits `cedf1c2` and `e7497a4`), fetched it (200), dropped the Sample data note, showed latest commit `e7497a4`, regression state CLEAR, 1 function (`bump`), and drew all three charts across both commits (CPU at 291,573; entries 3 and 1), with no console errors (headless Chrome via puppeteer-core, 1280 px).
- D15 done (found during that check): typing the URL key by key crashed the page (React error #185) in production builds; `MetricChart` is memoized and its series are constants, so typing no longer re-renders the charts. Checked against a local production build: 40, 99 and 200 typed characters and the real URL all work; it crashed at 40 before the fix. Checked on the live site after #20 deployed (headless Chrome): 40 and 200 typed characters and the real history URL all work, no console errors.
- Next up: no open defects. Per-function drill-down and trend alerting are the remaining roadmap items.

## Phase 1: See what exists, make CI honest

- [x] D3: open the live app and `npm run dev` in a browser; write down what renders
- [x] D6: tests that match the current UI; CI runs `npm run lint` and `npm test` as well as `build`
- [x] D12: CI on `actions/checkout@v7`, `setup-node@v7` and Node 24

## Phase 2: Identity and honesty

- [x] D1: real package name and `<title>`; regenerate `package-lock.json`
- [x] D13: remove the TESTNET_SYNC_ACTIVE badge
- [x] D14: header heading fits at 390 px
- [x] D4: "Sample data" label on the built-in history; remove the demo button that invents snapshots
- [x] Redeploy and confirm in a browser that the live title and content changed (2026-10-27, after #15: title "Budget Gate dashboard", Sample data note, no demo or badge)
- [x] D9: remove `docs/`, the `docs:*` scripts, `vitepress` and `vue`, the `/docs` route, `Docs.tsx` and `DOCUMENTATION.md`; matching `BudgetGate/docs` PR for the two dashboard pages that mention them
- [x] D10: `CONTRIBUTING.md` written for this repo (Node, `npm ci`, lint, test, build)

## Phase 3: Show what core actually measures

- [x] D7: charts for CPU, read bytes, write bytes, and read/write entries; handle `null` metrics; drop or hide memory
- [x] D8: validate `schema_version` on load with a clear error for unknown versions; a visible rate-limited state for 403/429
- [x] Charts readable without color alone, with units on the axes

## Phase 4: Real data (needs a decision)

- [x] D5: decided 2026-10-28: the Action appends each default-branch snapshot to `history.json` on a `history-branch` (soroban-budget-action #24), and the dashboard reads it as a public raw file through its existing `https://` source. A browser token was rejected (each viewer would paste a token that sits in browser storage), and so were the Actions cache and artifacts (browsers cannot read them without auth). No dashboard code change was needed.
- [ ] GitHub reading with pagination and caching (403/429 states done in D8)
- [x] Loading, empty, rate-limited and error states

## Phase 5: Polish

- [x] D2: README matches the app
- [ ] Per-function drill-down
- [ ] Trend alerting across several commits (functions trending toward a cap)

## Maintainer actions (Claude must not do these)

- [ ] Vercel: confirm the project redeploys from `main` after merges.
- [ ] Branch protection on `main`: currently 0 required reviews and no required status checks. Consider requiring `Dashboard CI / build` once it runs tests.
- [x] Decide between this repo's VitePress `docs/` and the separate `BudgetGate/docs` site: `BudgetGate/docs` (2026-10-26, workspace PR #2).
- [x] Vercel: remove or disconnect the `budgetgate-docs` project (D11). Deleted by the maintainer on 2026-10-27; it had served a stale copy of the old `docs/` at budgetgate-docs.vercel.app (now `DEPLOYMENT_NOT_FOUND`).
- [ ] Vercel: SPA fallback is not configured. Moot now that `/docs` is gone; needed if client-side routes are added later.
- [ ] Delete branches `docs/claude-md-and-roadmap` and `feature/complete-missing-specs`; both are fully in `main` (checked 2026-10-26).
