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

export interface CivicRecordPayload {
  type: 'civic_record';
  record_id: string;
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

export interface GroundReportPayload {
  type: 'ground_report';
  record_id: string;
  severity: number; // 1 - 10
  verdict: GroundReportVerdict;
  count_received: number;
  description: string;
  photo_cids: string[];
  reporter_role: ReporterRole;
  location?: string | null;
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
  description: string;
  suspiciousEditBlock: bigint;
  suspiciousEditTxHash: string;
  custodianWallet: string;
  oldStatus?: string;
  newStatus?: string;
  quantityGap?: number;
  contradictingReports: Array<{
    reportKey?: string;
    blockNumber: bigint;
    txHash: string;
    reporter: string;
    verdict: string;
    severity: number;
    description: string;
    photo_cids: string[];
  }>;
}

export interface CoverUpDetectionResult {
  isCoverUp: boolean;
  score: number; // 0 - 100
  scoreBreakdown: {
    contradictingReportsWeight: number;
    averageSeverityWeight: number;
    statusReversalWeight: number;
    reverseTimingWeight: number;
    quantityGapWeight: number;
    formula: string;
  };
  alertMessage?: string;
  evidences: CoverUpEvidence[];
}
