# What is BudgetGate?

BudgetGate is an automated, CI-native toolkit that protects Soroban smart contract developers from accidental resource-cost regressions. 

It accomplishes this by integrating deeply into your GitHub workflow, running `simulateTransaction` on your pull requests to calculate the real CPU, memory, and read/write bytes required for your functions.

## Problem Statement
Soroban enforces hard per-transaction resource limits. These limits are only knowable by executing a transaction. There is no automated, CI-integrated way to catch a resource-cost regression at PR time, much like Foundry's gas snapshots do for EVM contracts.

## Solution
BudgetGate solves this by bringing automated resource profiling to the Soroban ecosystem.
