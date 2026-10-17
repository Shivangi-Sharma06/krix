# Real Friction Log: Krix on Arkiv (Tiramisu Testnet)

This document records real engineering friction, SDK behaviors, and architectural observations encountered while developing and integrating Krix with the Arkiv SDK (v0.8.1) on the Tiramisu Testnet.

---

### 1. Numeric Range Filtering Requires Type Wrapping
- **Observation:** In Arkiv queries, range filters only function on numeric attributes (`i32`, `u64`). Timestamps and quantities must be stored as numbers or BigInt.
- **Friction:** When querying entities by composite attributes (e.g. `record_entity_key` and `type`), attributes must be explicitly wrapped in `str(...)` helper functions from `@arkiv-network/sdk/attr` or `@arkiv-network/sdk/query`. Passing raw JavaScript strings directly causes query syntax errors.

### 2. Client-Side Sorting Is Mandatory (No Server-Side `orderBy`)
- **Observation:** Arkiv's query API does not support server-side `orderBy` clauses.
- **Friction:** When displaying chronological claims on the Claims Ladder or listing revision histories, sorting must be performed client-side on fetched entities using their `blockNumber` or `createdAt` timestamps. Pagination limits must be handled with cursor iterations (`hasNextPage()` and `.next()`) before final display.

### 3. Client Account Configuration with EIP-1193 Providers
- **Observation:** `createWalletClient` from `@arkiv-network/sdk` with browser injected providers (e.g., MetaMask via `window.ethereum`) requires explicit passing of the user's active account address.
- **Friction:** If the `account` property is omitted during custom transport instantiation, Viem/Arkiv can throw `AccountNotFoundError` when creating entities or patching state. The adapter had to wrap both EIP-1193 providers and local private key accounts in a unified helper `getWalletArkivClient(accountOrProvider, userAddress)`.

### 4. Zero Gas / Unfunded Testnet Wallets
- **Observation:** Submitting live transactions (`createEntity`, `patchEntity`, `changeOwnership`, `extendEntity`) requires `$GLM` gas tokens on Tiramisu (Chain ID: 7738577).
- **Friction:** When testnet faucets are dry or rate-limited, local mock fallbacks (`isDemoModeActive()`) must be maintained so that UI developers, judges, and CI test suites can execute the full multi-party workflow without failing on un-funded zero-balance accounts.

### 5. Immutability Enforcement vs Cross-Entity Validation
- **Observation:** Arkiv's `readonly: true` flag guarantees that entities cannot be modified once published.
- **Friction:** Because entities are independent on-chain items, the blockchain itself does not enforce referential integrity (e.g., verifying that a referenced `record_entity_key` exists before creating a `statement`). The application layer adapter (`lib/arkiv.ts`) must enforce per-type validation, whitelisting, and referential checks before dispatching transactions to the network.
