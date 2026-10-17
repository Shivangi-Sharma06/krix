# Krix (JanAudit) — Tamper-Evident Civic Audit Layer

> *Supplies can be delayed. Truth cannot be deleted.*

Krix (JanAudit) is a public, tamper-evident audit web application for government civic and supply chain projects (such as Jan Aushadhi medicine batches, disaster relief kits, and ward civic works).

It combines:
1. An **official, mutable on-chain record (`civic_record`)** with cryptographic custody transfer (`changeOwnership`) and status patches (`patchEntity`).
2. An **uncensorable, permanent ground report layer (`ground_report`)** submitted with `readonly: true` and `permissionlessExtension: true`.
3. A **Time-Travel Diff Engine (`atBlock`)** that compares historical state against ground reports and detects cover-ups.

---

## 1. Prerequisites and Setup

- Node.js 20+ (recommended Node 22+)
- Web browser (Chrome / Brave / Firefox with MetaMask, or use the built-in demo wallet switcher)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start development server
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 2. Environment Variables (.env.example)

```env
NEXT_PUBLIC_CHAIN_ID=7738577
NEXT_PUBLIC_RPC_URL=https://rpc.tiramisu.db-chain.testnet.arkiv.network
NEXT_PUBLIC_EXPLORER_URL=https://tiramisu.explorer.arkiv.network
NEXT_PUBLIC_FAUCET_URL=https://hub.arkiv.network/
NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
```

---

## 3. How to Get Test Tokens ($GLM)

- **Network:** Tiramisu Testnet
- **Chain ID:** `7738577`
- **Native Currency:** `$GLM` (Golem)
- **Faucet:** Visit [Arkiv Hub Faucet](https://hub.arkiv.network/) to request test tokens for your wallet address.
- **Explorer:** [https://tiramisu.explorer.arkiv.network](https://tiramisu.explorer.arkiv.network)

*Note:* For quick testing and offline presentations, Krix includes a built-in **Demo Role Switcher** in the header with 6 pre-configured stakeholder personas (State Warehouse, Truck Distributor, Clinic Receiver, Doctor, Inspector, Citizen).

---

## 4. How to Run the Seed Script

To create the complete demo scenario from the PRD on-chain:

```bash
npm run seed
# or
npx tsx scripts/seed.ts
```

What the script does:
1. **Wallet A (Warehouse Custodian):** Creates batch `IND-AP-2026-04` (500 Dengue Kits).
2. **Handover A → B:** Transfers custody to Wallet B (Distributor / Truck).
3. **Transit:** Wallet B marks `status: 'IN_TRANSIT'` and hands over custody to Wallet C (Clinic Receiver).
4. **Receipt:** Wallet C logs arrival of 300 units with `status: 'DAMAGED'`.
5. **Ground Truth:** 3 immutable ground reports are submitted with `readonly: true`:
   - Doctor (Severity 9, DAMAGED, soaked boxes, photo proof)
   - Quality Inspector (Severity 8, DAMAGED, temperature violation)
   - Citizen (Severity 8, DAMAGED, shortage of kits)
6. **The Cover-Up Edit:** Custodian patches the official record status to `ALL_GOOD_DELIVERED` and claims 500 units received in pristine condition.

---

## 5. How to Run the Demo (Under 2 Minutes)

1. Open [http://localhost:3000](http://localhost:3000).
2. In the records list, click on record **`IND-AP-2026-04`** (marked with `[COVER-UP FLAGGED]`).
3. **Inspect the Custody Chain & Reconciliation Bar:**
   - Observe the custody progression: Hop #1 (Warehouse) → Hop #2 (Distributor) → Hop #3 (Clinic).
   - Check the quantity reconciliation: 500 dispatched, claimed 500 received, but reports document 200 damaged/unusable units.
4. **Time-Travel Slider:**
   - Drag the slider back to block `#410180` (or earlier).
   - Notice the side-by-side **Red / Green diff view** showing the transition where status was originally `DAMAGED` and later flipped to `ALL_GOOD_DELIVERED`.
5. **Detect Cover-Up Button:**
   - Click the red **"🔍 Detect Cover-Up"** button.
   - An alert appears:
     > *"ALERT: At block #410290, wallet 0x8a... changed status from DAMAGED to ALL_GOOD_DELIVERED, while 3 immutable citizen reports say DAMAGED."*
   - Review the Cover-Up Score (95/100) and the documented on-chain evidence with links to transactions and photo evidence.
6. **Verify Immutability:**
   - Click **"Test Immutability"** next to any citizen report. The attempt to mutate or delete the readonly entity fails with an on-chain integrity confirmation.
7. **Lifetime Extension:**
   - Click **"⏳ Extend Life (+30 days)"** on any report to invoke `extendEntity` permissionlessly.

---

## 6. Architecture & Implementation Decisions

- **Single Adapter Module (`lib/arkiv.ts`):** All Arkiv SDK client instantiations, queries (`select`, `atBlock`), and mutations (`createEntity`, `patchEntity`, `changeOwnership`, `extendEntity`) are centralized in `lib/arkiv.ts`.
- **Pure Detection Engine (`lib/detect.ts`):** Cover-up detection is a pure, deterministic function tested with Vitest (`lib/detect.test.ts`).
- **IPFS & Privacy (`lib/ipfs.ts`):** Client-side EXIF GPS stripping via canvas rasterization before CID generation; user-facing permanent and public disclosure warnings.
- **Client-Side Ordering:** Per Arkiv SDK rules (`sdk.txt`), no server-side `orderBy` is used; records and reports are filtered and sorted on the client.
- **Plain Functional UI:** Designed strictly with system fonts, white backgrounds, black text, thin gray borders, and functional red/green diff highlights.

---

## 7. Running Unit Tests

```bash
npm test
```
All unit tests for cover-up detection and clean record checks will run and pass.
