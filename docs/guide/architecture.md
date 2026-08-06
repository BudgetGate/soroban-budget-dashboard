# Architecture

BudgetGate consists of three main repositories working in unison:

1. **`soroban-budget-core`**: The Go-based execution engine that hits the Soroban RPC, fires the XDR payloads via `simulateTransaction`, and parses the JSON results to calculate deltas.
2. **`soroban-budget-action`**: The TypeScript-based GitHub Action that orchestrates the execution, reads your repository context, and formats the output into PR comments.
3. **`soroban-budget-dashboard`**: The React/Vite front-end that visually graphs your resource snapshots across commits.
