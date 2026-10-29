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
- **Per-function tables**, under the charts:
  - With all functions selected, **Functions** lists each function's latest measurement: the commit it came from, every metric with its change since the function's previous measurement, and its `pct_of_network_cap`. A function missing from the latest snapshot is marked "not in latest snapshot".
  - Selecting a function (in that table or the filter) shows its **History**: one row per snapshot, newest first, with each metric and its change, so a jump can be traced to its commit. Changes are against the last snapshot that contained the function; there is no change from a previous value of 0 or to an unknown value.

  An unreported value says "not reported"; a `pct_of_network_cap` of 0 (snapshots made before core read network caps) and an empty commit SHA say "not recorded".
- **Cards:** the latest commit, the number of tracked functions, and a regression state that flags a CPU increase of more than 10% between the last two snapshots. Only CPU is checked and the 10% is fixed; core's own thresholds are not applied here.
- **Trend alerts**, above the charts, for functions in the latest snapshot. They catch slow growth that the single-commit card misses:
  - **Cap projection:** a least-squares line through the function's `pct_of_network_cap` over its last 5 measurements; flagged when the line reaches 80% within 10 commits, or the share is already at 80%. Needs 5 measurements with a cap figure (snapshots made before core read caps have 0 and are skipped); the panel says when no function has them. `pct_of_network_cap` is the highest share of any one metric's cap, so the alert does not say which metric.
  - **Creep:** a metric that rose in each of the function's last 3 measurements and by 10% or more in total.

  The 80% and 10% match core's `--cap-warning-pct` and `--max-delta-pct` defaults; they are fixed here. Each alert shows the numbers behind it and opens the function's history.
- **Errors:** an unknown `schema_version` or a malformed history is shown as an error naming the snapshot. A GitHub rate limit (403/429) is shown as **RATE_LIMITED** with the time to try again, when GitHub gives one.

## Limitations

- History needs the GitHub Action's `history-branch` input (in the Action since `v0.2.0`). Private repositories cannot be read: the dashboard has no token.
- A `github://` history is reused for as long as GitHub's `Cache-Control: max-age` says it is fresh (60 s on the Contents API), because without a token even a 304 Not Modified costs one of the 60 requests per hour; the page says when it was fetched and until when a refresh reuses it. An `https://` source is left to the browser's HTTP cache (raw.githubusercontent.com sends `max-age=300`, so a refresh within 5 minutes may show the same copy). The refresh button reloads even when the URL is unchanged.

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
