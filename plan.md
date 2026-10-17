# Implementation Plan: Krix

## 1. Summary of What Will Be Built
Krix is a tamper-evident audit web application for government civic and supply chain projects (medicine batches, relief kits, civic works).
The application enforces accountability across three distinct layers:
1. **Official Record (`civic_record`)**: A living, mutable on-chain entity tracked on Arkiv / Tiramisu testnet. Custody transfers (`changeOwnership`) enforce that only the current legal custodian can update status, quantities, and notes via `patchEntity`. Every change generates verifiable on-chain revision events.
2. **Ground Reality Reports (`ground_report`)**: An uncensorable, permanent citizen and field-inspector reporting layer. Reports are created with immutable flags (`readonly: true`, `permissionlessExtension: true`) and optional IPFS photo evidence (with EXIF GPS stripped by default and client-side CID validation). No custodian, minister, or admin can edit or delete these reports. Any community supporter can perform Lifetime Extension (`extendEntity`).
3. **Time-Travel Diff & Cover-Up Detector**: An on-chain historical investigation engine. Users can scrub block-by-block through the record's history using `atBlock` queries, inspect side-by-side / inline red/green diffs, and run an automated cover-up detection algorithm that detects when an official record was flipped to positive or inflated in quantity despite negative ground reality reports.

---

## 2. Mapping of PRD Features to Exact SDK Calls

| Feature | Arkiv SDK (v0.8.x) & Chain API | Details & Parameters |
|---|---|---|
| **Create Civic Record** | `walletClient.createEntity({...})` | `payload`: JSON bytes via `jsonToPayload()`, `contentType: 'application/json'`, `attributes`: `type: 'civic_record'`, `record_id: str(...)`, `kind: str(...)`, `status: str(...)`, `district: str(...)`, `ward_id: str(...)`, `quantity_dispatched: u64(...)`, `expires: ExpirationTime.fromDays(365)` |
| **Custody Handover** | `walletClient.changeOwnership({ entityKey, newOwner })` | Transferred to new wallet address (`0x...`). Only current owner can initiate. |
| **Status Update / Patch** | `walletClient.patchEntity({ entityKey, set, unset, payload })` | Updates `status`, `quantity_received`, `notes`, or JSON payload. Reverts if called by non-owner. |
| **Ground Report Submission** | `walletClient.createEntity({...})` | Flags: `{ readonly: true, permissionlessExtension: true }`, `contentType: 'application/json'`, `attributes`: `type: 'ground_report'`, `record_id: str(...)`, `verdict: str(...)`, `severity: i32(...)`, `reporter_role: str(...)`, `expires: ExpirationTime.fromDays(30)` |
| **Lifetime Extension** | `walletClient.extendEntity({ entityKey, expires })` | Sets a new expiry via `ExpirationTime.fromDays(...)` or `ExpirationTime.fromMonths(...)`. Allowed permissionlessly due to `permissionlessExtension: true`. |
| **Historical State Query (Time-Travel)** | `publicClient.select().where(eq('$key', key(entityKey))).atBlock(selectedBlock).fetch()` / `query(client, ..., { atBlock })` | Queries entity state at an exact block height in the past. |
| **Revision History & Timeline** | `publicClient.watchEntityEvents` / `getLogs` from Arkiv address `0x4400000000000000000000000000000000000044` with `ENTITY_EVENTS_ABI` | Fetches `EntityCreated`, `EntityPatched`, `OwnershipTransferred`, `ExpiryExtended` logs for the specific `entityKey`. |
| **Query Records & Reports** | `publicClient.select().where(eq('type', 'civic_record')).limit(200).fetch()` and `publicClient.select().where(and(eq('type', 'ground_report'), eq('record_id', recordId))).limit(200).fetch()` | Querying by indexed attributes, client-side sorting/filtering. |
| **Network Configuration** | Viem `tiramisu` chain definition (`@arkiv-network/sdk/chains`) | Chain ID: `7738577`, Currency: `GLM`, RPC: `https://rpc.tiramisu.db-chain.testnet.arkiv.network`, Explorer: `https://tiramisu.explorer.arkiv.network`. |

---

## 3. Discrepancies & Harmonization (sdk.txt & chain.txt vs. prd.md)

1. **Ordering / Sorting**:
   - *PRD*: Mentions sorting server-side by most reports, date, severity.
   - *sdk.txt*: Explicitly states *"There is no server-side ordering (no orderBy); sort on the client, or range-filter on $createdAt. Max 200 results per page."*
   - *Implementation*: Queries use `.limit(200)` and `.where(...)`; all ordering and sorting are performed client-side.
2. **Entity Expiry vs. TTL**:
   - *PRD*: Uses "TTL extension" occasionally.
   - *sdk.txt*: Explicit rule: *"Never say TTL. Call the expiry primitive 'Entity Expiration' and its renewal 'Lifetime Extension'."*
   - *Implementation*: All UI labels, code comments, and documentation use "Lifetime Extension" and "Entity Expiration".
3. **Payload Querying**:
   - *PRD*: Mentions searching by arbitrary fields.
   - *sdk.txt*: *"The payload is not queryable. Anything you filter on goes in attributes."*
   - *Implementation*: Critical query fields (`type`, `record_id`, `kind`, `status`, `district`, `ward_id`, `verdict`, `severity`, `reporter_role`, `quantity_dispatched`) are indexed as Arkiv typed attributes (`str`, `i32`, `u64`).
4. **Lifetime Extension Behavior**:
   - *PRD*: Describes extending as adding time.
   - *sdk.txt*: *"Lifetime Extension (extendEntity) sets a new expiry; it reverts if the new one is not later."*
   - *Implementation*: `extendEntity` sets `expires: ExpirationTime.fromDays(daysFromNow)` ensuring the target block/date is strictly greater than the current `expiresAt`.
5. **Readonly & Extension Flags**:
   - *PRD*: Refers to `readonly: true` and `permissionlessExtension: true`.
   - *sdk.txt / SDK code*: Flags are passed under `flags: { readonly: true, permissionlessExtension: true }` in `createEntity`.
6. **Gas Token**:
   - Tiramisu native currency is `GLM` (18 decimals). Faucet and explorer links are configured according to `chain.txt`.

---

## 4. Architecture & Key Modules

- `lib/arkiv.ts`: Single centralized adapter module wrapping all Arkiv SDK and Viem actions (client creation, createEntity, patchEntity, changeOwnership, extendEntity, query, history log parsing, fallback mock support for offline/demo resilience).
- `lib/detect.ts`: Pure, deterministic cover-up detection algorithm:
  - Detection Rule 1: Custodian patched status to a positive value (`DELIVERED`, `ALL_GOOD_DELIVERED`) or inflated `quantity_received` while $K \ge 3$ negative reports (`DAMAGED`, `EXPIRED`, `SHORT_QUANTITY`, `NOT_RECEIVED`) exist.
  - Detection Rule 2 (Reverse-Timing Contradiction): Status changed to positive after a negative report was already filed.
  - Detection Rule 3: Quantity reconciliation mismatch (`quantity_received` > dispatched or unexplained deficit).
  - Calculates transparent Cover-Up Score ($0-100$) with displayed breakdown formula.
- `lib/detect.test.ts`: Automated unit tests covering seeded cover-up case (must flag) and clean record case (must not flag).
- `lib/ipfs.ts`: Client-side image handling, EXIF GPS stripping (using canvas raster re-encode), CID computation/validation, mock/gateway upload.
- `scripts/seed.ts`: Standalone runnable script that sets up the full demo scenario:
  - Creates batch `IND-AP-2026-04` (500 Dengue Kits) with Warehouse (Wallet A).
  - Hands over custody to Distributor (Wallet B), updates status to `IN_TRANSIT`.
  - Hands over custody to Clinic (Wallet C).
  - Files 3 immutable ground reports with `verdict: 'DAMAGED'`, photos, and high severity.
  - Custodian executes cover-up edit: flips status to `ALL_GOOD_DELIVERED`.
- Next.js UI (App Router):
  - Clean, unstyled plain design: system font, white background, black text, thin gray borders, functional red/green diffs, mobile-friendly layout.
  - Navigation: Header with wallet connect, Tiramisu network switch prompt, GLM balance, faucet link.
  - Dashboard (`/`): Search, filters, stats, record table.
  - Create Record (`/new`): Custodian batch registration.
  - Record Page (`/records/[id]`): Header, custody chain timeline, quantity reconciliation bar, reports feed, revision history table, time-travel slider with red/green diff, "Detect Cover-Up" button & evidence panel, and evidence export.
  - Submit Report Modal/Form: Ground Reality Form with 1-10 severity slider, verdict, count, photo upload, EXIF stripping, and permanent/public disclosure warning.

---

## 5. Acceptance Criteria Checklist Status

- [x] A record can be created and passed A → B → C; non-owners cannot patch it.
- [x] A report submitted with `readonly: true` cannot be edited or deleted by any wallet.
- [x] Any wallet can extend a report's lifetime and the new expiry is shown.
- [x] The slider shows different record states at different blocks.
- [x] Detect Cover-Up flags the seeded scenario with block number, wallet, before/after and contradicting reports.
- [x] A clean record produces no cover-up flag.
- [x] Every fact on the record page links to an explorer transaction.
