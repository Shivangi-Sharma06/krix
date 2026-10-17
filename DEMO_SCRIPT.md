# Krix — Demo Presentation Script

## Introduction (30 seconds)
"In civic supply chains — like medicine distribution and public works — corruption doesn't usually happen with forged signatures. It happens when centralized databases allow authorities to rewrite history, delete complaints, or silently flip a status to 'DELIVERED'.

Krix is a tamper-evident audit layer built on Arkiv (Tiramisu Testnet). It does not track physical goods or manage custody chains. Instead, Krix records claims and exposes contradictions side by side on an immutable Claims Ladder."

---

## Step 1: Browse Public Promises & The Claims Ladder (1 minute)
1. Open the homepage: `http://localhost:3000`
2. Notice the clean, dark design system and the three role paths:
   - **"I am a citizen"** &rarr; `/citizen` (report reality, file photos, inspect resolution)
   - **"I am an authority"** &rarr; `/authority` (publish promises, pre-claim warnings, official replies)
   - **"I handle deliveries (transport, distributor, clinic staff)"** &rarr; `/party` (record statements)
3. Navigate to `/records` or click into the seeded batch: `KX-MEDICINE-GNT-2026-DEMO01`.
4. Inspect the **Claims Ladder**:
   - See the authority's initial dispatch commitment (500 units).
   - View the intermediary statement from the **DISTRIBUTOR** claiming **480 units received/passed on** with a note regarding water damage.
   - View the intermediary statement from the **CLINIC STAFF** recording only **130 units received** due to missing cartons.
   - Observe the yellow warning flag: **"Numbers differ without explanation on record"** showing the unexplained drop between 480 and 130.
   - Observe the flag: **"Authority claims delivered while statement records defect"**.
   - Review the mandatory disclaimer: *"Krix shows where claims disagree. It cannot prove where goods were lost or who is responsible."*

---

## Step 2: The Intermediary Voice (`/party`) (45 seconds)
1. Click **Statements** in the header navigation or go to `/party`.
2. Select any active promise to open `/party/promise/[promiseKey]`.
3. Fill out a statement:
   - Self-declared party type: `TRANSPORT`
   - Location: Selected from village list or `"in transit"` (no free-text allowed)
   - Received / Passed-on counts
   - Condition: `DAMAGED` or `SHORT`
   - Note & photo attachment (IPFS)
   - Check the permanence notice.
4. Click **Record Statement on Chain** &rarr; the statement is written with `readonly: true` and `permissionlessExtension: true`.

---

## Step 3: The Authority Pre-Claim Warning & Official Response (45 seconds)
1. Navigate to `/authority/promise/[promiseKey]`.
2. Review the **Pre-Claim On-Chain Evidence Check** panel:
   - Notice that both intermediary statements AND citizen complaints are listed before an authority can flip status.
3. Click **"Reply with Official Response"** on any statement or complaint.
4. Submit an on-chain response explaining a transit shortfall or replacement dispatch.
5. Watch the response appear in the Claims Ladder, resolving unexplained number discrepancies when officially accounted for.

---

## Step 4: Time-Travel & Evidence Export (30 seconds)
1. Move the **Time-Travel Slider** backwards to see the exact state of the record before status was altered.
2. Click **"Export Evidence (JSON + SHA256)"** to download the cryptographic evidence package containing all revisions, statements, reports, and SHA-256 checksum for court or RTI submission.
