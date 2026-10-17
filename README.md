# Krix — Tamper-Evident Civic Audit Layer

> *Supplies can be delayed. Truth cannot be deleted.*

Krix is a public, tamper-evident audit layer for government civic projects and public distribution supply chains (medicine batches, relief kits, and ward civic works).

It is built with **Next.js 15 (React 19, TypeScript)**, **Viem**, **@arkiv-network/sdk (v0.8.1)** on the **Tiramisu Testnet** (Chain ID: 7738577), and client-side privacy-preserving IPFS photo handling.

---

## 1. What is Live vs Simulated (Honest Status)

| Feature / Primitive | Live Status on Tiramisu | Notes |
|---|---|---|
| **Tiramisu RPC Node Connectivity** | **LIVE** | Live HTTP RPC connection to `https://rpc.tiramisu.db-chain.testnet.arkiv.network`. Real block number polled every 15s (`#a8900+`). Header reflects network health and fallback status. |
| **Arkiv SDK Query Engine (`select`, `atBlock`)** | **LIVE** | Arkiv queries execute against the live testnet node. Supported filter syntax: `type = str('civic_record')` and custom attributes wrapped in `str(...)`. |
| **On-Chain Entity Creation & Transactions** | **LIVE (Gas Required)** | Live `createEntity`, `patchEntity`, `changeOwnership`, and `extendEntity` execute via Viem on contract `0x4400000000000000000000000000000000000044`. Requires funded `$GLM` test tokens. |
| **Demo / Simulation Mode** | **OPTIONAL (Explicit Flag)** | Controlled strictly by `NEXT_PUBLIC_DEMO_MODE=true`. Displays a permanent yellow banner: *"DEMO MODE - data is simulated locally and is not on the live blockchain"*. In production (`NODE_ENV=production`), demo mode is blocked unless `NEXT_PUBLIC_ALLOW_DEMO_IN_PROD=true` is explicitly provided. |
| **Cover-Up Detection Algorithm (`lib/detect.ts`)** | **LIVE & PURE** | 100% deterministic, pure functional logic counting distinct independent reporter wallets ($K \ge 3$), filtering out custodian self-reports, detecting tampering on immutable fields, and computing a weighted score. Verified by automated unit tests (`lib/detect.test.ts`). |
| **IPFS Photo Storage (`lib/ipfs.ts`)** | **LIVE / HYBRID** | Client-side magic-byte sniffing (JPEG/PNG/WebP), EXIF GPS stripping via HTML5 Canvas rasterization, deterministic SHA-256 CIDv1 computation, and multiple gateway fallbacks. |

---

## 2. Environment Variables

Create or edit `.env.local`:

| Variable | Required | Where to Get / Purpose |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Default: `7738577` (Tiramisu Testnet). |
| `NEXT_PUBLIC_RPC_URL` | Yes | Default: `https://rpc.tiramisu.db-chain.testnet.arkiv.network`. |
| `NEXT_PUBLIC_EXPLORER_URL`| Yes | Default: `https://explorer.tiramisu.db-chain.testnet.arkiv.network`. |
| `NEXT_PUBLIC_FAUCET_URL` | Yes | Default: `https://hub.arkiv.network/faucet`. |
| `NEXT_PUBLIC_DEMO_MODE` | No | Set `true` for offline demo presentation. Set `false` for live chain. |
| `NEXT_PUBLIC_ALLOW_DEMO_IN_PROD` | No | Default `false`. Set `true` only if demo mode is permitted in production builds. |
| `SEED_PRIVATE_KEY` | For seed | Test wallet private key (never exposed to client). Fund with `$GLM` at `https://hub.arkiv.network/faucet`. |
| `PINATA_JWT` / `NEXT_PUBLIC_IPFS_GATEWAY` | Optional | Pinata API token or IPFS gateway URL (defaults to `https://ipfs.io/ipfs/`). |

---

## 3. Exact Commands to Run

```bash
# 1. Install dependencies
npm install

# 2. Run unit test suite (11/11 tests pass)
npm test

# 3. Build production bundle (Next.js 15)
npm run build

# 4. Start production server
npm run start
# (Or run development server):
npm run dev

# 5. Run idempotent seed script against live chain
npm run seed
```

App runs at: **`http://localhost:3000`**

---

## 4. Audit & Verification of the 13 Checklist Items

| # | Item | Status | How Implemented & Verified |
|---|---|---|---|
| 1 | **Record Identity** | **FIXED** | Removed record ID text input from `/new`. Canonical identifier is the Arkiv entity key (`/records/[entityKey]`). URLs and reports reference canonical entity keys. Auto-generates human-readable reference codes (`KX-<KIND>-<DISTRICT>-<YEAR>-<6CHARS>`). Entity key format validated; malformed/unknown keys route cleanly to 404 page. |
| 2 | **Immutable Fields** | **FIXED** | Companion `dispatch_manifest` entity (`readonly: true`) created at batch creation. `patchEntity` in `lib/arkiv.ts` strictly whitelists only `status`, `quantity_received`, and `notes`. Detection engine flags changes to genesis fields as high-severity `TAMPERING`. |
| 3 | **Demo / Live Isolation** | **FIXED** | "Test Immutability" button removed from production record UI (preserved on `/how-it-works`). Persona dropdown switcher disabled in live mode; live user role is derived directly from the connected wallet. In production (`NODE_ENV=production`), demo mode is blocked unless `NEXT_PUBLIC_ALLOW_DEMO_IN_PROD=true`. |
| 4 | **Access Control & Custody** | **FIXED** | Custodian actions (patch, handover) verify custodian ownership against the live chain right before sending. Handover verifies checksummed address, blocks zero address and self-transfer, and requires modal confirmation that handover is irreversible. State machine forbids invalid transitions and over-deliveries. |
| 5 | **Ground Reality Report Form** | **FIXED** | Requires connected wallet. Enforces limit of 3 reports/day per wallet per record. Enforces max 3 photos. Magic bytes sniffed for JPEG/PNG/WebP. GPS coordinates stripped from EXIF before upload. Reporter role self-declared badge displayed. Reports from current custodian are flagged and excluded from cover-up detection. |
| 6 | **Detection Engine Hardening** | **FIXED** | Counts distinct independent reporter wallets ($K \ge 3$, configured in `lib/constants.ts`). Reversals within 48h / 7,200 blocks trigger reverse timing weight. Formula and weights transparently broken down. Neutral, factual language used ("documented discrepancies", "evidence"). Unit tests cover dirty and clean records. |
| 7 | **Performance & Limits** | **FIXED** | Paginated fetching with cursor handling (`hasNextPage()`). Polling pauses when browser tab is inactive (`visibilitychange`). Optimistic UI updates with rollback on RPC rejection. Countdown timer on entity expiration with "+30d" extension button (`permissionlessExtension`). |
| 8 | **Quantity Reconciliation** | **FIXED** | Visual quantity reconciliation bar comparing `quantity_dispatched`, `quantity_received`, and average citizen-reported quantity. Flags shortage warning with exact difference. "Confirm Receipt" shortcut pre-fills status to DELIVERED or PARTIAL based on quantity. |
| 9 | **IPFS & Media Handling** | **FIXED** | Magic-byte format verification (JPEG/PNG/WebP). EXIF GPS stripped via canvas rasterization. Strict CIDv0/v1 regex validation. Array of gateway fallbacks configured. |
| 10 | **UI & Accessibility** | **FIXED** | Restrained institutional design system: system/Inter font, no gradients, no emojis, 1px border cards. Focus rings, semantic HTML elements, accessible form labels, copy buttons with toast notifications, SHA-256 evidence export. |
| 11 | **Security & Error Handling** | **FIXED** | Content Security Policy in `next.config.js` permitting self, Tiramisu RPC, and IPFS gateways. Zod validation schema in `lib/config.ts`. Friendly error pages (`app/not-found.tsx`, `app/error.tsx`). `SEED_PRIVATE_KEY` restricted to server-side scripts. |
| 12 | **Documentation & Hindi Support** | **FIXED** | Interactive `/how-it-works` page explaining the 3 modules with an English / Hindi toggle. |
| 13 | **Seed Script Idempotency** | **FIXED** | `scripts/seed.ts` queries existing records by reference code before creating duplicates. Checks live `$GLM` balance and logs faucet URL. Prints transaction hashes and canonical entity key URLs for all steps. |
