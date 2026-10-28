# soroban-budget-dashboard

A web app that charts a history of [Budget Gate](https://github.com/BudgetGate/soroban-budget-core) snapshots, so you can see at which commit a Soroban contract function got more expensive. It runs entirely in the browser, with no backend.

- Live: [budgetgate-dashboard.vercel.app](https://budgetgate-dashboard.vercel.app/)
- User docs: [budgetgate.github.io/docs/dashboard](https://budgetgate.github.io/docs/dashboard/)

Budget Gate is not audited and not production-ready.

## What it shows

- **Data source.** Enter a URL in the `DATASOURCE_URL` box. It must return a history: an object with a `snapshots` array of [core snapshots](https://github.com/BudgetGate/soroban-budget-core/blob/main/SCHEMA.md) with `schema_version` `1.0` or `2.0`. Two forms work:
  - `https://…`: any URL that returns the JSON.
  - `github://owner/repo/branch/path/to/history.json`: a file in a public repository, read through the GitHub REST API without a token (60 requests per hour per IP address).

  The [GitHub Action](https://github.com/BudgetGate/soroban-budget-action) writes this file when its `history-branch` input is set: each push to the default branch appends that commit's snapshot to `history.json` on the branch. For a public repository, enter `https://raw.githubusercontent.com/<owner>/<repo>/budgetgate-history/history.json` (GitHub serves it to browsers on other sites and may cache it for up to 5 minutes).

  Without a URL, the page shows built-in examples under a **Sample data** note. They are not measurements.
- **Charts**, per snapshot, for one function or all functions summed:
  - CPU instructions
  - Ledger bytes: read and write
  - Footprint entries: all and read-write

  A value that is missing or `null` is drawn as a gap, not as 0. Memory is not charted, because core records it as `null`.
- **Cards:** the latest commit, the number of tracked functions, and a regression state that flags a CPU increase of more than 10% between the last two snapshots. Only CPU is checked and the 10% is fixed; core's own thresholds are not applied here.
- **Errors:** an unknown `schema_version` or a malformed history is shown as an error naming the snapshot. A GitHub rate limit (403/429) is shown as **RATE_LIMITED** with the time to try again, when GitHub gives one.

## Limitations

- History needs the GitHub Action's `history-branch` input (in the Action's `main`, not in a release yet). Private repositories cannot be read: the dashboard has no token.
- Results are not cached, and entering the same URL again does not reload it.

## Development

Requires Node.js 24 (what CI uses).

```bash
git clone https://github.com/BudgetGate/soroban-budget-dashboard.git
cd soroban-budget-dashboard
npm ci
npm run dev       # Vite dev server, http://localhost:5173 by default
npm run lint      # oxlint
npm test          # Vitest
npm run build     # type-check, then build into dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules for changes and pull requests.

## Deployment

Vercel builds every pull request as a preview and deploys `main` to the live URL. `npm run build` writes a static site to `dist/`.

## Security

See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
