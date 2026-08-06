# Getting Started

To get started with BudgetGate, you will use the GitHub Action inside your Soroban project.

## Installation

Add the following to your `.github/workflows/budget.yml`:

```yaml
name: BudgetGate

on:
  pull_request:
    branches: [ "main" ]

jobs:
  check-budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run BudgetGuard
        uses: BudgetGate/soroban-budget-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          baseline-path: 'baseline.json'
          new-path: 'new.json'
```

When you open a PR, BudgetGate will execute your simulations, compare them to the `baseline.json`, and comment a markdown report natively on your pull request.
