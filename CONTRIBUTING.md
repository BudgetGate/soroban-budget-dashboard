# Contributing to soroban-budget-dashboard

## Local setup

1. Install Node.js 24 (CI uses it; Vite 8 needs at least 20.19 or 22.12).
2. Clone the repository and install the locked dependencies:
   ```bash
   npm ci
   ```
3. Check your environment:
   ```bash
   npm run lint      # oxlint
   npm test          # Vitest with jsdom; the data API is mocked, no network
   npm run test:coverage  # the same tests with a coverage summary (what CI runs)
   npm run build     # tsc -b (type-checks src/, tests included), then vite build
   ```
4. Run the app with `npm run dev` and open the URL Vite prints.

CI runs the same three commands, in that order, on every pull request to `main`. Vercel builds a preview of each pull request.

## Rules for changes

- **Never show invented numbers as measurements.** Sample data is allowed only when the UI labels it as sample data. Real numbers come from snapshots written by [soroban-budget-core](https://github.com/BudgetGate/soroban-budget-core).
- **The snapshot format belongs to core.** Read core's `SCHEMA.md` before changing how snapshots are parsed. Don't define fields here, and treat an unknown `schema_version` as an error rather than guessing.
- **Every state has a screen:** loading, empty, error and rate-limited. A blank chart is not an error state.
- **No secrets in the bundle.** Anything in a `VITE_*` environment variable ships to the browser, so never put a token there.
- **Strict TypeScript.** Strict mode is TypeScript 6's default (the tsconfig doesn't set it, so don't turn it off). No `any` without a comment saying why.
- **Tests** mock `fetchSnapshotHistory` with typed snapshot data. Check what the page shows, not implementation details.
- **Charts** must be readable without colour alone and show units.
- **Docs** for users live in [BudgetGate/docs](https://github.com/BudgetGate/docs), not in this repo.
- **Dependencies:** check that the existing stack can't do the job before adding one, and say why in the PR.

## Submitting a PR

- Base your branch on `main`.
- Link the issue it resolves (`Closes #<n>`), and keep the change to that issue.
- Say in the PR what you ran and what you saw. For UI changes, say that you looked at the page in a browser (`npm run dev` or the Vercel preview) and what it showed.
- If you change what the app shows or how it loads data, open a matching PR in [BudgetGate/docs](https://github.com/BudgetGate/docs) and link the two.
