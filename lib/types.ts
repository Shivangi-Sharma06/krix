import type { Hex } from 'viem';

export type CivicRecordKind = 'MEDICINE_BATCH' | 'RELIEF_KIT' | 'ROAD_WORK' | 'WATER_WORK';

export type CivicRecordStatus =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'DAMAGED'
  | 'PARTIAL'
  | 'ALL_GOOD_DELIVERED';

export type GroundReportVerdict =
  | 'DAMAGED'
  | 'EXPIRED'
  | 'SHORT_QUANTITY'
  | 'NOT_RECEIVED'
  | 'ALL_GOOD';

export type ReporterRole = 'DOCTOR' | 'INSPECTOR' | 'CITIZEN';

export type StatementPartyType = 'TRANSPORT' | 'DISTRIBUTOR' | 'FACILITY_STAFF' | 'OTHER';

export type StatementCondition = 'OK' | 'DAMAGED' | 'EXPIRED' | 'SHORT' | 'DELAYED';

/**
 * Immutable Statement from an intermediary or facility party (readonly: true, permissionlessExtension: true)
 */
export interface StatementPayload {
  type: 'statement';
  record_entity_key: Hex; // Canonical link to promise / record entity key
  party_type: StatementPartyType; // Self-declared
  location: string; // chosen from village list or "in transit"
  received_count?: number;
  passed_on_count?: number;
  condition: StatementCondition;
  note: string; // plain text max 500
  photo_cids: string[]; // IPFS only max 3
  event_date?: string; // self-declared event date (optional)
}

/**
 * Readonly Response from Authority replying to a complaint key or statement key
 */
export interface AuthorityResponsePayload {
  type: 'authority_response';
  record_entity_key: Hex;
  target_key: Hex; // References complaint key or statement key
  target_type: 'complaint' | 'statement';
  response_text: string;
  official_role?: string;
}

/**
 * Dispatch Manifest: Created as an immutable second entity (readonly: true)
 * at record genesis to guarantee origin parameters can never be silently overwritten.
 */
export interface DispatchManifestPayload {
  type: 'dispatch_manifest';
  record_entity_key: Hex;
  reference_code: string;
  kind: CivicRecordKind;
  quantity_dispatched: number;
  expiry_date?: string;
  origin: string;
  destination: string;
  creator_wallet: Hex;
  created_at_block?: bigint;
}

/**
 * Mutable Civic Record: Only status, quantity_received, and notes may be patched.
 */
export interface CivicRecordPayload {
  type: 'civic_record';
  reference_code: string; // KX-<KIND>-<DISTRICT>-<YEAR>-<6CHARS>
  manifest_key?: Hex;     // Key of immutable dispatch_manifest entity
  kind: CivicRecordKind;
  title: string;
  quantity_dispatched: number;
  quantity_received: number;
  status: CivicRecordStatus;
  origin: string;
  destination: string;
  expiry_date?: string;
  district: string;
  ward_id: string;
  notes: string;
}

/**
 * Immutable Ground Reality Report (readonly: true, permissionlessExtension: true)
 */
export interface GroundReportPayload {
  type: 'ground_report';
  record_entity_key: Hex; // Canonical link to Arkiv record entity key
  severity: number;       // 1 - 10
  verdict: GroundReportVerdict;
  count_received: number;
  description: string;
  photo_cids: string[];
  reporter_role: ReporterRole; // Note: Self-declared in UI
  location?: string | null;
  is_custodian_submission?: boolean; // Flagged if reporter matches record custodian
}

export interface CustodyHop {
  wallet: string;
  blockNumber: bigint;
  txHash: string;
  timestamp?: number;
}

export interface RecordRevision {
  blockNumber: bigint;
  txHash: string;
  updater: string;
  type: 'CREATED' | 'PATCHED' | 'OWNERSHIP_TRANSFERRED';
  status?: CivicRecordStatus;
  quantity_received?: number;
  notes?: string;
  rawPayload?: Partial<CivicRecordPayload>;
}

export interface CoverUpEvidence {
  ruleId: string;
  findingType: 'COVER_UP' | 'TAMPERING';
  description: string;
  suspiciousEditBlock: bigint;
  suspiciousEditTxHash: string;
  custodianWallet: string;
  oldStatus?: string;
  newStatus?: string;
  quantityGap?: number;
  tamperedFields?: string[];
  contradictingReports: Array<{
    reportKey?: string;
    blockNumber: bigint;
    txHash: string;
    reporter: string;
    verdict: string;
    severity: number;
    description: string;
    photo_cids: string[];
    is_custodian_submission?: boolean;
  }>;
}

export interface CoverUpDetectionResult {
  isCoverUp: boolean;
  hasTampering: boolean;
  score: number; // 0 - 100
  scoreBreakdown: {
    independentReportersWeight: number;
    averageSeverityWeight: number;
    statusReversalWeight: number;
    reverseTimingWeight: number;
    quantityGapWeight: number;
    tamperingWeight: number;
    formula: string;
  };
  alertMessage?: string;
  evidences: CoverUpEvidence[];
}

export type LadderClaimSource = 'AUTHORITY' | 'STATEMENT' | 'CITIZEN_REPORT' | 'AUTHORITY_RESPONSE';

export interface LadderClaimEntry {
  id: string;
  source: LadderClaimSource;
  blockNumber: bigint;
  txHash: string;
  wallet: string;
  isAuthorityWallet: boolean;
  isDuplicateWallet: boolean; // Same wallet as an earlier claim party
  partyType?: StatementPartyType | ReporterRole | 'AUTHORITY';
  claimedQuantity?: number;
  receivedCount?: number;
  passedOnCount?: number;
  condition?: StatementCondition | GroundReportVerdict;
  location?: string;
  statusClaim?: string;
  notes?: string;
  photoCids?: string[];
  rawEntityKey?: string;
}

export interface LadderFinding {
  ruleId: string;
  type: 'NUMBERS_DIFFER' | 'NO_STATEMENT' | 'CONDITION_CONTRADICTION' | 'DELAY_CONTRADICTION' | 'TIMELINE_ANOMALY';
  severity: 'WARNING' | 'ALERT' | 'INFO';
  title: string;
  description: string;
  blockTimes?: { earlierBlock: bigint; laterBlock: bigint };
  difference?: number;
  involvedWallets?: string[];
}

export interface ClaimsLadderResult {
  claims: LadderClaimEntry[];
  findings: LadderFinding[];
  uniqueIndependentWallets: number;
  totalStatements: number;
  totalCitizenReports: number;
  disclaimer: string;
}

