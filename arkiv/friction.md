# Arkiv Engineering Friction Report: Krix on Tiramisu Testnet

This report provides specific, reproducible feedback on building Krix with `@arkiv-network/sdk` (version 0.8.1) on the Arkiv Tiramisu Testnet (chain ID 7738577). 

## 1. Project Context and How We Used the SDK

Krix is a civic audit ledger that records government commitments (promises, medicine batches, relief materials) and juxtaposes them against citizen eyewitness reports and intermediary statements. We used Arkiv as a decentralized, tamper-evident database:
- **`createEntity`:** Used across five distinct entity types (`civic_record`, `dispatch_manifest`, `ground_report`, `statement`, `authority_response`), applying `readonly: true` to prevent alteration of complaints and statements, and `permissionlessExtension: true` to allow public lifetime extensions.
- **`patchEntity`:** Used exclusively to update mutable transit status, received counts, and audit notes on `civic_record`.
- **`changeOwnership`:** Used for officer succession and custodian handovers.
- **`atBlock`:** Used to inspect prior record states and detect retroactive edits (cover-ups).
- **Attribute Queries:** Used with typed equality filters (`eq`) and cursor pagination (`hasNextPage()`, `next()`).

---

## 2. What Worked Really Well

- **Protocol-Enforced Readonly Entities:** The `readonly: true` creation flag reliably blocks all modification attempts at the Arkiv protocol level. We verified this programmatically via `attemptIllegalReportPatch` in `lib/arkiv.ts`, which consistently rejects unauthorized mutations without needing custom Solidity assertion code.
- **Native JSON Payloads:** Helpers like `jsonToPayload()` and `entity.toJson()` make it straightforward to read and write structured JSON documents without writing custom ABI encoders or serialization logic.
- **`atBlock` Querying:** Being able to append `.atBlock(blockNumber)` directly to a `select()` query made historical state inspection accessible directly over standard RPC, avoiding the need to run a dedicated archive node or custom indexing backend.
- **Block Confirmation Times:** The 2-second block time on Tiramisu makes interactive state updates feel fast and predictable during development.

---

## 3. SDK and Queries

### Attribute values in query filters require manual type wrappers
- **What I was trying to do:** Query entities using standard JavaScript primitives, for example: `publicClient.select().where(eq('type', 'civic_record')).fetch()`.
- **What I expected:** The SDK query builder to accept primitive strings and numbers and infer the attribute type, or accept literal values.
- **What actually happened:** TypeScript rejected the call with type errors because `eq()` expects an `AttributeValue`. Passing bare strings caused runtime serialization failures. Attributes must be manually wrapped with SDK helper functions such as `str('civic_record')` or `i32(10)`.
- **Workaround we used:** In `lib/arkiv.ts` (functions `fetchCivicRecords`, `fetchCivicRecordByKey`, `fetchGroundReports`, `fetchStatements`), imported `str`, `i32`, `u64`, and `key` from `@arkiv-network/sdk/attr` and explicitly wrapped every attribute parameter.
- **How to reproduce:**
  1. Install `@arkiv-network/sdk@0.8.1`.
  2. Instantiate a public client with `createPublicClient({ chain: tiramisu, transport: http(RPC_URL) })`.
  3. Attempt to run: `client.select().where(eq('type', 'civic_record')).fetch()`.
  4. Note TypeScript compiler error: `Argument of type 'string' is not assignable to parameter of type 'AttributeValue'`.
- **Suggestion for Arkiv:** Overload query methods like `eq(field, value)` so that if a raw string, number, or boolean is provided, the SDK automatically wraps it in `str(value)` or numeric equivalents.
- **Severity:** Cost us time (approximately 2 hours during initial integration).

### Absence of server-side ordering forces full client-side fetching and sorting
- **What I was trying to do:** Display the latest 10 citizen complaints and driver statements in chronological order on the Claims Ladder.
- **What I expected:** A query modifier such as `.orderBy('$createdAt', 'desc')` or `.sort('createdAt', 'desc')` on the query builder.
- **What actually happened:** Arkiv queries do not support server-side ordering clauses. Query results are returned in internal storage sequence.
- **Workaround we used:** In `lib/arkiv.ts` (functions `fetchGroundReports`, `fetchStatements`, `fetchAuthorityResponses`), the client fetches all pages in a pagination loop using `while (res.hasNextPage()) { res = await res.next(); }` and sorts the resulting array in JavaScript: `reports.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1))`.
- **How to reproduce:**
  1. Inspect the `SelectQueryBuilder` type definitions in `@arkiv-network/sdk/query`.
  2. Notice the absence of any `orderBy`, `sort`, or `order` methods.
  3. Query a dataset with multiple entities and observe that entities are not guaranteed to be ordered by block timestamp.
- **Suggestion for Arkiv:** Add index-level sorting support for core metadata attributes like `$createdAt` and `$updatedAt` (for example, `.orderBy('$createdAt', 'desc')`). This will prevent client applications from having to paginate through entire collections merely to display the latest updates.
- **Severity:** Cost us time (approximately 3 hours to implement client-side pagination accumulators and in-memory sorters).

---

## 4. Wallet and Transactions

### Injected browser providers (EIP-1193) throw `AccountNotFoundError` unless the active address is explicitly passed
- **What I was trying to do:** Initialize a wallet client for browser users with `createArkivWalletClient({ chain: tiramisu, transport: custom(window.ethereum) })` to send `createEntity` and `patchEntity` transactions.
- **What I expected:** The wallet client to query the active account from the browser provider via `eth_accounts` or `eth_requestAccounts`.
- **What actually happened:** When executing `walletClient.createEntity(...)`, the call threw: `AccountNotFoundError: Could not find an Account to execute with this Action. Please provide an account.`
- **Workaround we used:** In `lib/arkiv.ts` (`getWalletArkivClient`), we inspect the user's active address and pass it explicitly:
  ```typescript
  return createArkivWalletClient({
    chain: tiramisu,
    transport,
    ...(account ? { account } : {}),
  });
  ```
- **How to reproduce:**
  1. Open a browser with MetaMask connected.
  2. Call `const client = createArkivWalletClient({ chain: tiramisu, transport: custom(window.ethereum) });`.
  3. Attempt `await client.createEntity({ payload: jsonToPayload({ test: true }) });`.
  4. Observe `AccountNotFoundError`.
- **Suggestion for Arkiv:** Allow `createArkivWalletClient` to resolve the default signer automatically from the custom EIP-1193 transport if an explicit `account` argument is not supplied, mirroring Viem's browser wallet ergonomics.
- **Severity:** Cost us time (approximately 2 hours debugging browser wallet initialization).

### Shared public testnet namespace causes potential entity collisions across applications
- **What I was trying to do:** Query all civic records created by our application on the shared Tiramisu testnet with `where(eq('type', str('civic_record')))`.
- **What I expected:** A client configuration option or namespace prefix that scopes queries to our specific project.
- **What actually happened:** Arkiv maintains a flat entity namespace on the testnet. If another developer publishes an entity with `type = str('civic_record')` or `type = str('statement')` with a different JSON schema, our frontend queries retrieve those foreign entities, causing schema parsing errors.
- **Workaround we used:** In `lib/arkiv.ts`, we implemented defensive parsing: validating reference code formats (`KX-...`) and checking for mandatory schema properties before rendering entities, silently discarding non-conforming items.
- **How to reproduce:**
  1. Publish an entity with attribute `type = str('statement')` but with payload `{ randomField: 123 }`.
  2. Call `fetchStatements` from Krix.
  3. The foreign entity is returned by the query, requiring explicit schema guards to avoid frontend crashes.
- **Suggestion for Arkiv:** Provide a first-class application namespace feature (for example, passing `namespace: 'krix'` to the client), which automatically prefixes or filters an `$app` attribute on all entities and queries.
- **Severity:** Minor annoyance, but an important stability consideration on shared public testnets.

---

## 5. Chain and Expiry

### Protocol-level lack of referential constraints requires application-layer integrity checks
- **What I was trying to do:** Link citizen reports and transit statements to a parent promise record via `record_entity_key`.
- **What I expected:** An on-chain foreign key or constraint mechanism that verifies the referenced parent entity exists and has not expired.
- **What actually happened:** Arkiv entities are independent records. A client can call `createEntity` with `record_entity_key: str('0x1111...1111')` for a non-existent parent, and the Arkiv contract will confirm the transaction successfully.
- **Workaround we used:** In `lib/arkiv.ts` (`submitStatementOnChain`, `submitGroundReportOnChain`, `submitAuthorityResponseOnChain`), the adapter verifies key format via `isValidEntityKey()` and checks the existence of the parent record before or during data aggregation.
- **How to reproduce:**
  1. Generate an arbitrary 32-byte hex string.
  2. Call `client.createEntity` for a statement with `record_entity_key` pointing to that random string.
  3. The transaction succeeds on chain.
- **Suggestion for Arkiv:** Add an optional attribute constraint type (for example, `parentKey: key(...)`) that verifies target existence at the precompile level during entity creation.
- **Severity:** Minor annoyance.

### Unfunded testnet accounts block transaction workflows when public faucets are depleted
- **What I was trying to do:** Run end-to-end multi-party seeding scripts (`scripts/seed.ts`) simulating authority, distributor, and clinic interactions.
- **What I expected:** Continuous faucet availability or subsidized testnet gas for standard hackathon testing.
- **What actually happened:** When the web faucet at `https://hub.arkiv.network/faucet` experienced rate limits or downtime, newly generated testing addresses could not execute transactions due to lack of `$GLM`.
- **Workaround we used:** In `scripts/seed.ts`, added balance checking via `publicClient.getBalance({ address })` that displays actionable warnings and faucet URLs. In `lib/arkiv.ts`, maintained an explicit local demo simulation fallback (`isDemoModeActive()`) so UI workflows can be evaluated even if a wallet is unfunded.
- **How to reproduce:**
  1. Generate a new private key without requesting test tokens from the faucet.
  2. Execute `npm run seed`.
  3. The script halts with an insufficient gas balance error.
- **Suggestion for Arkiv:** Provide an authenticated API endpoint or developer faucet CLI command so automated CI pipelines and local seed scripts can request testnet gas directly without manual browser CAPTCHAs.
- **Severity:** Cost us time (approximately 2 hours during seed script development).

---

## 6. Documentation

### Minimal TypeScript examples for `changeOwnership` and input address validation
- **What I was trying to do:** Implement on-chain officer succession and custody transfers using `client.changeOwnership({ entityKey, newOwner })`.
- **What I expected:** SDK documentation detailing expected address formats, return types, and failure modes.
- **What actually happened:** The documentation did not mention whether `newOwner` requires checksummed addresses. Supplying lowercase or non-checksummed addresses resulted in generic precompile revert errors.
- **Workaround we used:** In `lib/arkiv.ts` (`changeRecordCustodyOnChain`), we wrapped the input with Viem's `getAddress()`, verified that the address is non-zero, and confirmed that the caller is the current on-chain owner before dispatching the transaction.
- **How to reproduce:**
  1. Call `client.changeOwnership({ entityKey, newOwner: '0x0000000000000000000000000000000000000000' })`.
  2. Observe a generic contract execution revert without a descriptive error message explaining that the zero address is disallowed.
- **Suggestion for Arkiv:** Expand the SDK reference documentation to include input requirements (such as checksummed addresses) and common revert reasons for `changeOwnership` and `extendEntity`.
- **Severity:** Minor annoyance (cost approximately 1 hour).

---

## 7. Things to Confirm Before Submitting

- Confirm that your local `.env.local` has a funded `SEED_PRIVATE_KEY` with `$GLM` test tokens from `https://hub.arkiv.network/faucet` if you plan to demonstrate live seed script execution (`npm run seed`) during judging.
- Confirm that your preferred explorer URL (`https://tiramisu.explorer.arkiv.network`) matches the explorer configured in your deployment environment.
