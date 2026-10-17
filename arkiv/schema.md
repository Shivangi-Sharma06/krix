# Arkiv Entity Schemas: Krix

Krix uses Arkiv as an immutable, tamper-evident web3 database on the Tiramisu Testnet. Every entity has explicit ownership, expiration, and immutability flags.

---

## 1. Entity Type: `statement` (NEW)

### Purpose
Intermediaries (transport operators, truck drivers, regional warehouse distributors, clinic staff) handle goods between dispatch and receipt. In centralized systems, custody logs are mutable or non-existent. In Krix, intermediaries are **just another voice**: their statements are optional, read-only claims that provide independent operational transparency without turning Krix into an enforced custody tracker.

### Specification & Flags
- **Entity Type:** `statement`
- **Readonly:** `true` (Cannot be edited, patched, or deleted by anyone once created on-chain)
- **Permissionless Extension:** `true` (Any supporter, auditor, or journalist can call `extendEntity` and pay gas tokens to extend the lifetime of this statement)
- **Default Lifetime:** 30 days (`ExpirationTime.fromDays(30)`)
- **Who Writes It:** Intermediary or facility parties (transport drivers, regional distributors, clinic receiving staff, third parties). Anyone with a Web3 wallet can submit; their role is self-declared.

### Payload Schema
```json
{
  "type": "statement",
  "record_entity_key": "0x4400...0044",
  "party_type": "DISTRIBUTOR",
  "location": "in transit",
  "received_count": 480,
  "passed_on_count": 480,
  "condition": "DAMAGED",
  "note": "Received 480 boxes at hub depot; 20 boxes soaked during torrential rain, moisture observed on seals.",
  "photo_cids": ["bafybeidvl63fgh4g2rtd6g4a33tewxupk2c27bkjffvhjklmno3pqr4stu"],
  "event_date": "2026-10-17"
}
```

### Indexed Attributes
- `type`: `str('statement')`
- `record_entity_key`: `str(recordEntityKey)` (Canonical foreign-key link to the referenced promise)
- `party_type`: `str('TRANSPORT' | 'DISTRIBUTOR' | 'FACILITY_STAFF' | 'OTHER')` (Self-declared)
- `condition`: `str('OK' | 'DAMAGED' | 'EXPIRED' | 'SHORT' | 'DELAYED')`
- `location`: `str(locationLabel)` (Selected strictly from promise village list or `"in transit"`, no free-text)
- `received_count`: `i32(received_count)` (Optional integer >= 0)
- `passed_on_count`: `i32(passed_on_count)` (Optional integer >= 0)

### Why Readonly & Permissionless Extension?
1. **Readonly (`readonly: true`):** An intermediary cannot retract a statement under pressure from a contractor or department official. If a driver notes water damage or short count, that claim remains on-chain forever.
2. **Permissionless Extension (`permissionlessExtension: true`):** If an investigation or court case outlasts the standard expiration window, any journalist, auditor, or citizen can renew the statement's life on Arkiv without needing permission from the original signer or an authority admin.

### Why This Breaks on Postgres / IPFS / Subgraph / Private API
- **Postgres / SQL Server:** Centralized database administrators or malicious officials with root credentials can execute `UPDATE statements SET count = 500 WHERE id = ...` or `DELETE FROM statements` to eliminate evidence of missing or damaged cargo.
- **Pure IPFS:** IPFS provides content addressing, but has no native access control, no on-chain time stamps, and no entity lifecycle/expiration guarantees. Anyone can unpin or garbage collect data, and there is no canonical queryable state machine or atomic link to the official record.
- **The Graph / Subgraph:** Subgraphs are read-only indexers of EVM event logs. They cannot create entities, enforce storage expiration, or provide native `changeOwnership` / `extendEntity` primitives. Subgraphs rely on an underlying smart contract for state.
- **Private APIs (REST / GraphQL):** Single point of failure; API gateways can silently filter out negative statements, throttle citizen endpoints, or censor critical complaints.

---

## 2. Entity Type: `authority_response` (NEW)

### Purpose
Allows the public authority to formally reply to a citizen ground report or an intermediary statement on the claims ladder.

### Flags & Rules
- **Entity Type:** `authority_response`
- **Readonly:** `true`
- **Permissionless Extension:** `true`
- **Who Writes It:** Custodian or authority wallet addressing a specific complaint or statement key.
- **Target Link:** Strictly references a canonical `ground_report` or `statement` entity key.

---

## 3. Existing Core Entities

- **`civic_record`:** Mutable promise record representing the official government commitment. Ownership transfers via Arkiv `changeOwnership` for officer succession.
- **`dispatch_manifest`:** Immutable companion entity (`readonly: true`) created at genesis to guarantee original quantity, destination, and origin can never be altered.
- **`ground_report`:** Uncensorable citizen eyewitness report (`readonly: true`, `permissionlessExtension: true`) with photo evidence and severity score.
