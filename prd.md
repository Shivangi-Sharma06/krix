# Krix — Product Requirements Document (PRD)

**Version:** 1.0 (Hackathon MVP)
**Date:** 17 Oct 2026
**Stack:** Arkiv + Tiramisu Chain, IPFS, Next.js (React) frontend
**Tagline:** *Supplies can be delayed. Truth cannot be deleted.*

---

## 1. Problem Statement

In India, government supply chains (Jan Aushadhi medicine cartons, flood-relief kits) and civic works (ward roads, water supply) lose accountability between dispatch and delivery:

1. Out of 500 cartons dispatched, ~200 go missing, or expired/damaged goods reach the rural clinic.
2. When a field inspector, doctor or citizen files a complaint on a government portal, a corrupt database admin (who controls Postgres/SQL Server) can silently **delete the complaint** or **flip the official record** from `FAILED` to `DELIVERED_OK`.

Centralized databases have a single point of trust. There is no tamper-proof record of what was reported on the ground versus what the official record claims.

## 2. Product Vision

Krix is a public, tamper-evident audit layer for government supply batches and ward projects. It combines:

- an **official, updatable record** with enforced custody transfer, and
- an **uncensorable citizen/inspector report layer** that nobody can edit or delete,
- plus a **time-travel diff engine** that automatically exposes cover-ups by comparing history against ground reality.

## 3. Goals and Non-Goals

### Goals
- G1: Every batch/project has a living on-chain record with a verifiable chain of custody.
- G2: Citizens, doctors and inspectors can submit reports that cannot be edited or deleted by anyone.
- G3: Anyone can detect when an official record was changed in contradiction to citizen reports.
- G4: Reports stay alive as long as someone cares, via permissionless TTL extension.
- G5: A judge or journalist understands the value in under 2 minutes of demo.

### Non-Goals (MVP)
- Integration with real government ERP/portals (mock data is used).
- Payment, tendering or procurement workflows.
- Identity verification (Aadhaar etc.). MVP uses wallet-based identity.
- Native mobile apps (responsive web only).

## 4. Target Users and Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Warehouse Officer** (Wallet A) | State warehouse custodian who creates batches | Create batch, hand over custody |
| **Distributor / Truck Operator** (Wallet B) | Intermediate custodian | Update transit status, hand over to clinic |
| **Rural Clinic / Ward Receiver** (Wallet C) | Final recipient | Confirm receipt with counts |
| **Field Inspector / Doctor** | Ground-truth observer | Submit tamper-proof reports with photo proof |
| **Citizen** | Any resident who sees a failure | Submit complaint easily, even without technical knowledge |
| **Journalist / Auditor / Judge** | Public watchdog | Browse records, run cover-up detection, export evidence |
| **Supporter** | Anyone who wants a complaint to stay alive | Extend a report's lifetime by paying a small fee |

## 5. Core Concepts and Arkiv Mapping

> Note: function and flag names below follow the original project concept. Verify exact SDK method names, parameters and entity limits against the current Arkiv docs and Tiramisu chain docs before implementation.

| Krix concept | Arkiv primitive |
|---|---|
| Supply batch / civic project record | Entity with type `civic_record` (mutable) |
| Custody handover | `changeOwnership()` |
| Status / location update by current custodian | `patchEntity` (owner-only) |
| Citizen/inspector ground report | Entity with type `ground_report`, `readonly: true` |
| Keep a report from expiring | `extendEntity` with `permissionlessExtension: true`, paid in `$GLM` |
| Historical state for time-travel | Query with `atBlock: <blockNumber>` |
| Photo evidence | Uploaded to IPFS; CID stored in the report |

## 6. Functional Requirements

### 6.1 Module A — Official Record (Living Wiki Page)

**FR-A1: Create record.** An authorized creator (Wallet A) can create a `civic_record` for a supply batch or ward project.

Fields:
- `record_id` (e.g. `IND-AP-2026-04`)
- `kind`: `MEDICINE_BATCH` | `RELIEF_KIT` | `ROAD_WORK` | `WATER_WORK`
- `title` (e.g. "500 Dengue Kits")
- `quantity_dispatched` (number)
- `origin` and `destination` (text + optional geo coordinates)
- `expiry_date` (for medicines)
- `status`: `CREATED` | `IN_TRANSIT` | `DELIVERED` | `DAMAGED` | `PARTIAL` | `ALL_GOOD_DELIVERED`
- `current_custodian` (wallet)
- `notes`
- `ward_id` / `district` for filtering

**FR-A2: Custody handover.**
- The current owner calls `changeOwnership(newOwner)`.
- After transfer, only the new owner can `patchEntity`; the previous owner loses write access.
- UI must show a visual **custody chain** (A → B → C) with block number, timestamp and wallet for each hop.
- Handover to the final receiver (Wallet C) requires the sender to specify the dispatched quantity.

**FR-A3: Status update.** The current custodian can update `status`, `quantity_received`, and `notes` via `patchEntity`. Every update creates a new revision (retrievable through `atBlock`).

**FR-A4: Record page.** A public, shareable page per record showing:
- header (title, ID, current status, current custodian)
- custody chain timeline
- quantity reconciliation (dispatched vs received vs reported-damaged)
- list of citizen/inspector reports
- revision history and cover-up detector (Module C)

**FR-A5: Browse and search.** A public dashboard listing all records with filters: kind, district/ward, status, "has conflicting reports", date. Sorting by "most reports" and "highest severity".

### 6.2 Module B — Uncensorable Ground Reality Form

**FR-B1: Submit report.** Each record page has a "Submit Ground Reality Form" button. Form fields:
- `record_id` (auto-linked)
- `severity` (1–10 slider)
- `verdict`: `DAMAGED` | `EXPIRED` | `SHORT_QUANTITY` | `NOT_RECEIVED` | `ALL_GOOD`
- `count_received` (number)
- `description` (text, max ~500 chars)
- `photo_cid` (IPFS hash of uploaded photo; multiple allowed)
- `location` (optional, with consent)
- `reporter_role`: `DOCTOR` | `INSPECTOR` | `CITIZEN`

**FR-B2: Immutability.** Reports are written with `readonly: true`. No one (admin, minister, reporter) can edit or delete them. The UI must show an "Immutable" badge with the creation block number and transaction hash.

**FR-B3: Permissionless extension.** Reports are written with `permissionlessExtension: true`.
- Any user can call `extendEntity` and pay a small `$GLM` amount to extend expiry.
- UI shows a **"Time left"** countdown per report and an **"Extend life"** button.
- Show a "Protected by N supporters" counter and total extension contributed.
- Show a warning badge on reports expiring within 7 days.

**FR-B4: Photo upload.** Image upload to IPFS with a client-side preview, size limit (e.g. 5 MB) and EXIF location stripping by default. The CID is stored on-chain; the image renders through a public IPFS gateway.

**FR-B5: Report feed.** Per record: list of reports sorted by time with severity color-coding, reporter role, verdict, photo thumbnail and extension status.

**FR-B6: Spam and abuse mitigation (MVP-level).**
- One wallet can submit at most N reports per record per day (enforced in the app layer and displayed transparently).
- Reports carry the wallet address publicly; the pseudonymous wallet is the identity.
- A "weight" indicator is computed in the UI (e.g. inspectors/doctors with on-chain role attestations weigh more, see 6.5).

**FR-B7: Reporter privacy.** Do not collect names, phone numbers or exact location unless the user opts in. Warn users that anything submitted is permanent and public.

### 6.3 Module C — "Catch the Cover-Up" Time-Travel Slider

**FR-C1: Revision history.** A Wikipedia-style revision list for each `civic_record`: block number, timestamp, wallet that made the change, changed fields.

**FR-C2: Time-travel slider.** A slider that scrubs through blocks. Moving it re-queries the record with `atBlock: <selectedBlock>` and renders the state of the record at that moment alongside the reports that existed at that block.

**FR-C3: Diff view.** Side-by-side and inline diff between any two blocks, with changed fields highlighted (red for removed/old value, green for new value).

**FR-C4: "Detect Cover-Up" button.** One click runs the detection algorithm:

1. Fetch the current record state and all historical revisions.
2. Fetch all `ground_report` entities for the record.
3. Flag a **cover-up** when a custodian edit changed status to a "positive" value (`DELIVERED`, `ALL_GOOD_DELIVERED`) or increased `quantity_received` **while** at least K readonly reports (default K = 3, configurable) with negative verdicts exist (created before or after the edit).
4. Also flag a **reverse-timing contradiction**: status changed to positive after the first negative report was created.
5. Output an alert in plain language, for example:
   > "ALERT: At block #410290, wallet 0x8a… changed status from DAMAGED to ALL_GOOD_DELIVERED, while 3 immutable citizen reports say DAMAGED."
6. List the evidence: the block, wallet, tx hash, before/after values and the contradicting reports (with links and photos).

**FR-C5: Visual red diff.** Contradictions are shown in red on the timeline: a marker at the block of the suspicious edit and markers for each conflicting report.

**FR-C6: Quantity reconciliation check.** Flag when `quantity_received` > sum implied by reports, or when dispatched − received is unexplained (e.g. 500 sent, 300 claimed delivered, no loss record).

**FR-C7: Cover-up score.** A transparent 0–100 score per record computed from: number of contradicting reports, severity average, count of status reversals, time between report and edit, and unexplained quantity gap. The formula must be visible on the page.

**FR-C8: Export evidence.** Generate a shareable evidence report (PDF or link) containing block numbers, transaction hashes, diffs, reports and IPFS CIDs, so journalists and courts can verify independently.

### 6.4 Module D — Wallet and Access

- **FR-D1:** Connect wallet (MetaMask or compatible) to Tiramisu chain; auto-prompt to add or switch network.
- **FR-D2:** Read-only browsing requires no wallet.
- **FR-D3:** Role-aware UI: show custodian actions only when the connected wallet is the current owner of that record.
- **FR-D4:** Show test-token faucet link and `$GLM` balance in the header.
- **FR-D5:** Transaction status toasts with a link to the block explorer.

### 6.5 Module E — Roles and Attestations (Stretch)

- Optional registry of "verified" inspector/doctor wallets (attested by an NGO/auditor wallet) shown with a badge.
- Weighted reports in cover-up score.
- Not required for MVP.

### 6.6 Module F — Notifications and Sharing (Stretch)

- Shareable links and social cards for a record or an alert.
- Optional watch-list: subscribe to a record and get alerts when a cover-up is detected (email/Telegram bot via off-chain indexer).

### 6.7 Module G — Demo Mode

- **FR-G1:** A "Seed demo data" script that creates a batch `IND-AP-2026-04: 500 Dengue Kits`, performs the A → B → C handovers, submits 3 damaged reports, then performs a "cover-up" edit to `ALL_GOOD_DELIVERED`.
- **FR-G2:** Guided demo overlay that walks judges through: view record → open slider → drag back → click Detect Cover-Up → see red diff.
- **FR-G3:** Multiple demo wallets switchable in-app for the presentation.

## 7. Data Model

### `civic_record` (mutable, owned)
```json
{
  "type": "civic_record",
  "record_id": "IND-AP-2026-04",
  "kind": "MEDICINE_BATCH",
  "title": "500 Dengue Kits",
  "quantity_dispatched": 500,
  "quantity_received": 0,
  "status": "IN_TRANSIT",
  "origin": "State Warehouse, Vijayawada",
  "destination": "PHC Mangalagiri",
  "expiry_date": "2027-03-31",
  "district": "Guntur",
  "ward_id": "W-12",
  "notes": ""
}
```
Arkiv annotations (indexable): `type`, `record_id`, `kind`, `status`, `district`, `ward_id`.

### `ground_report` (immutable)
```json
{
  "type": "ground_report",
  "record_id": "IND-AP-2026-04",
  "severity": 8,
  "verdict": "DAMAGED",
  "count_received": 300,
  "description": "Boxes wet, seals broken",
  "photo_cids": ["bafy..."],
  "reporter_role": "DOCTOR",
  "location": null
}
```
Flags: `readonly: true`, `permissionlessExtension: true`. Annotations: `type`, `record_id`, `verdict`, `severity`, `reporter_role`.

## 8. System Architecture

- **Frontend:** Next.js + TypeScript + Tailwind; wallet connection via wagmi/viem (or ethers).
- **Chain layer:** Arkiv SDK on Tiramisu chain for entity create/patch/ownership/extend and queries (`atBlock`).
- **Storage:** IPFS (Pinata, web3.storage or similar) for photos; only CIDs go on-chain.
- **Indexing:** Use Arkiv annotation queries for lists and filters. Optional lightweight off-chain cache for the dashboard.
- **Diff engine:** Client-side module that pulls revisions, normalizes them and runs detection rules (FR-C4). Must be a pure, unit-tested function.
- **No central admin database.** Nothing in the app can alter or hide reports.

## 9. Key User Flows

1. **Dispatch:** Warehouse creates record → calls `changeOwnership` to distributor.
2. **Transit:** Distributor patches status to `IN_TRANSIT` → hands over to clinic wallet.
3. **Receive:** Clinic records `quantity_received` and status.
4. **Report:** Doctor opens record → fills form → uploads photo → submits (immutable).
5. **Cover-up attempt:** Custodian patches status to `ALL_GOOD_DELIVERED`.
6. **Detection:** Journalist opens record → drags slider back or clicks Detect Cover-Up → sees red diff, evidence and score → exports evidence.
7. **Preservation:** Supporter clicks Extend life on an expiring report and pays `$GLM`.

## 10. Non-Functional Requirements

- **Integrity:** No UI path may suggest a report can be edited/deleted; no backend that can hide on-chain data.
- **Performance:** Record page loads in under 3 s on a mid-range phone on 4G; the diff runs in under 2 s for up to 200 revisions and 500 reports.
- **Accessibility and reach:** Mobile-first, low-bandwidth friendly, WCAG AA contrast. Language toggle English / Hindi / Telugu (stretch).
- **Security:** Sanitize all user text (XSS); validate IPFS CIDs; strip EXIF GPS from photos by default; rate-limit client submissions.
- **Transparency:** Every displayed fact links to its block and transaction on the explorer.
- **Privacy:** Wallet-only pseudonymity; explicit "permanent and public" warning before submit.
- **Reliability:** Graceful handling of RPC failures, pending transactions and expired entities.

## 11. UI Screens

1. **Landing / Dashboard:** Hero, stats (records, reports, cover-ups detected), searchable records table.
2. **Record Page:** Header, custody chain, reconciliation bar (dispatched/received/reported), reports feed, revision history, Detect Cover-Up CTA.
3. **Submit Ground Reality Form:** Modal or page with severity slider, verdict, count, photo upload and permanence warning.
4. **Time-Travel View:** Block slider, state-at-block panel, red/green diff, evidence list.
5. **Create Record / Handover:** Forms for custodians with ownership confirmation.
6. **Evidence Export:** Printable/shareable report.
7. **Demo Guide:** Overlay with step prompts.

## 12. Success Metrics

- Demo: judge can reproduce cover-up detection in under 2 minutes.
- 100% of reports show as non-editable on-chain (verified via failed edit attempt in demo).
- Detection correctly flags the seeded cover-up and does not flag a clean record (unit tests).
- Time to submit a report under 60 seconds including photo.

## 13. MVP Scope and Milestones

**P0 (must for demo)**
- Wallet connect, create record, `changeOwnership`, `patchEntity`
- Ground report form with `readonly` + `permissionlessExtension` + IPFS photo
- Record page, reports feed, revision history
- Time-travel slider with `atBlock` and red diff
- Detect Cover-Up with alert text and evidence list
- Seed/demo script

**P1**
- Extend-life UI with countdown and supporter counter
- Cover-up score and quantity reconciliation
- Browse/search/filter dashboard
- Evidence export

**P2 (stretch)**
- Verified-inspector attestations and weighted reports
- Multilingual UI
- Watch-list alerts, share cards

**Suggested timeline (hackathon)**
| Phase | Work |
|---|---|
| Day 1 | Chain setup, schema, create/patch/ownership, wallet connect |
| Day 2 | Report form, IPFS, readonly/extension, record page |
| Day 3 | Revision history, `atBlock` slider, diff engine, Detect Cover-Up |
| Day 4 | Seed data, polish, demo script, tests, evidence export |

## 14. Risks and Open Questions

| Risk / question | Mitigation |
|---|---|
| Exact Arkiv SDK API names/limits differ from this spec | Review official docs first; wrap SDK calls in one adapter module |
| Entity expiry (BTL) can remove old data from `atBlock` queries | Confirm retention behavior; document the guarantee honestly; encourage extension |
| Spam/fake reports can flood a record | Rate limits, role weighting, visible reporter wallets, severity-weighted score |
| A custodian could collude with reporters | Score is evidence, not proof; show raw data and sources |
| Photo content may include faces/PII | EXIF strip, upload guidelines, warning text |
| Wallet onboarding is hard for rural users | Assisted submission by inspectors/NGOs; sponsored-gas idea for future |
| `$GLM`/test-token availability on Tiramisu | Provide faucet links and pre-funded demo wallets |
| Legal exposure of permanent public accusations | Neutral language ("reports indicate"), no automated accusations by name beyond wallet addresses |

## 15. Future Scope

- Integration with real procurement portals (read-only feeds).
- QR codes on cartons that link to the record page.
- IoT/cold-chain sensor attestations for medicines.
- DAO-style community of verified auditors.
- RTI-ready evidence packs.

## 16. Acceptance Criteria (MVP)

- [ ] A record can be created and passed A → B → C; non-owners cannot patch it.
- [ ] A report submitted with `readonly: true` cannot be edited or deleted by any wallet (attempt is shown failing).
- [ ] Any wallet can extend a report's lifetime and the new expiry is shown.
- [ ] The slider shows different record states at different blocks.
- [ ] Detect Cover-Up flags the seeded scenario with block number, wallet, before/after and contradicting reports.
- [ ] A clean record produces no cover-up flag.
- [ ] Every fact on the record page links to an explorer transaction.