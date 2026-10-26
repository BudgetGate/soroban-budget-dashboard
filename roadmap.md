# soroban-budget-dashboard roadmap

Progress tracker for this repo. The defect IDs (D1, D2, …) and their evidence are in `CLAUDE.md` section 3; the order comes from `CLAUDE.md` section 4. Tick a box only when the change is merged to `main` and, for UI changes, checked in a browser.

Last updated: 2026-10-26

## Where I left off

- No work has started in this repo yet. `main` is at `fc69fae`. Lint and build pass; all 3 tests fail.
- The live site at budgetgate-dashboard.vercel.app still has the title `temp_vite`.
- Next up: open the app in a browser (D3), then fix the tests and CI (D6).

## Phase 1: See what exists, make CI honest

- [ ] D3: open the live app and `npm run dev` in a browser; write down what renders
- [ ] D6: tests that match the current UI; CI runs `npm run lint` and `npm test` as well as `build`

## Phase 2: Identity and honesty

- [ ] D1: real package name and `<title>`; regenerate `package-lock.json`
- [ ] D4: "Sample data" label on the built-in history; remove the demo button that invents snapshots
- [ ] Redeploy and confirm in a browser that the live title and content changed

## Phase 3: Show what core actually measures

- [ ] D7: charts for CPU, read bytes, write bytes, and read/write entries (after core PR #9); handle `null` metrics; drop or hide memory
- [ ] D8: validate `schema_version` on load with a clear error for unknown versions
- [ ] Charts readable without color alone, with units on the axes

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
- [ ] Decide between this repo's VitePress `docs/` and the separate `BudgetGate/docs` site (the rules allow only one).
