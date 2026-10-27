# soroban-budget-dashboard roadmap

Progress tracker for this repo. The defect IDs (D1, D2, …) and their evidence are in `CLAUDE.md` section 3; the order comes from `CLAUDE.md` section 4. Tick a box only when the change is merged to `main` and, for UI changes, checked in a browser.

Last updated: 2026-10-27

## Where I left off

- `main` is at `7f2236a` (after #11). Lint and build pass. The live title is still `temp_vite` (D1).
- The live site at budgetgate-dashboard.vercel.app still has the title `temp_vite`.
- D9 done: `docs/`, the `docs:*` scripts, `vitepress`, `vue`, `react-markdown` (only `Docs.tsx` used it), the `/docs` route, `Docs.tsx` and `DOCUMENTATION.md` are gone. READ DOCS links to budgetgate.github.io/docs/dashboard/; the EXTERNAL DOCS button (pointing at the stale Vercel copy) is removed.
- Found during D9: `docs/` was deployed after all, by a second Vercel project `budgetgate-docs` (D11). The maintainer deleted that project on 2026-10-27; budgetgate-docs.vercel.app now returns `DEPLOYMENT_NOT_FOUND`, and commits get only the app's `Vercel` status.
- D6 done: the 6 tests describe the current UI and pass; CI runs lint and tests before the build.
- D12 done: CI runs on Node 24 with `actions/checkout@v7` and `setup-node@v7`, so it no longer warns about Node 20.
- D10 done: `CONTRIBUTING.md` describes this repo (Node 24, `npm ci`, lint, test, build, the section 6 rules, PR checklist) instead of core's Go guide.
- D7 done: three charts (CPU instructions; read/write bytes; footprint entries), units on the axes, dashed second series, memory dropped, unknown values drawn as gaps instead of 0. Checked in headless Chrome against `npm run dev` with sample data and with a two-snapshot history measured by core on testnet (counter v1 → v2).
- Next up: D8 (`schema_version` check, 403/429). D3 (the deployed app) still needs a browser look.

## Phase 1: See what exists, make CI honest

- [ ] D3: open the live app and `npm run dev` in a browser; write down what renders
- [x] D6: tests that match the current UI; CI runs `npm run lint` and `npm test` as well as `build`
- [x] D12: CI on `actions/checkout@v7`, `setup-node@v7` and Node 24

## Phase 2: Identity and honesty

- [ ] D1: real package name and `<title>`; regenerate `package-lock.json`
- [ ] D4: "Sample data" label on the built-in history; remove the demo button that invents snapshots
- [ ] Redeploy and confirm in a browser that the live title and content changed
- [x] D9: remove `docs/`, the `docs:*` scripts, `vitepress` and `vue`, the `/docs` route, `Docs.tsx` and `DOCUMENTATION.md`; matching `BudgetGate/docs` PR for the two dashboard pages that mention them
- [x] D10: `CONTRIBUTING.md` written for this repo (Node, `npm ci`, lint, test, build)

## Phase 3: Show what core actually measures

- [x] D7: charts for CPU, read bytes, write bytes, and read/write entries; handle `null` metrics; drop or hide memory
- [ ] D8: validate `schema_version` on load with a clear error for unknown versions
- [x] Charts readable without color alone, with units on the axes

## Phase 4: Real data (needs a decision)

- [ ] D5: decide with the maintainer how snapshot history reaches the dashboard (public raw files, a token held only in the browser, or committed snapshot JSON). Blocked until decided.
- [ ] GitHub reading with pagination and caching; visible 403/429 states
- [ ] Loading, empty, rate-limited and error states

## Phase 5: Polish

- [ ] D2: README matches the app
- [ ] Per-function drill-down
- [ ] Trend alerting across several commits (functions trending toward a cap)

## Maintainer actions (Claude must not do these)

- [ ] Vercel: confirm the project redeploys from `main` after merges.
- [ ] Branch protection on `main`: currently 0 required reviews and no required status checks. Consider requiring `Dashboard CI / build` once it runs tests.
- [x] Decide between this repo's VitePress `docs/` and the separate `BudgetGate/docs` site: `BudgetGate/docs` (2026-10-26, workspace PR #2).
- [x] Vercel: remove or disconnect the `budgetgate-docs` project (D11). Deleted by the maintainer on 2026-10-27; it had served a stale copy of the old `docs/` at budgetgate-docs.vercel.app (now `DEPLOYMENT_NOT_FOUND`).
- [ ] Vercel: SPA fallback is not configured. Moot now that `/docs` is gone; needed if client-side routes are added later.
- [ ] Delete branches `docs/claude-md-and-roadmap` and `feature/complete-missing-specs`; both are fully in `main` (checked 2026-10-26).
