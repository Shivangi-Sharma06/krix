import type {
  CivicRecordPayload,
  GroundReportPayload,
  RecordRevision,
  CoverUpDetectionResult,
  CoverUpEvidence,
  GroundReportVerdict,
  DispatchManifestPayload,
} from './types';
import { DETECTION_CONFIG } from './constants';

export interface DetectionInputReport {
  key?: string;
  blockNumber: bigint;
  txHash: string;
  creator: string;
  payload: GroundReportPayload;
}

export interface DetectionInput {
  currentRecord: CivicRecordPayload;
  manifest?: DispatchManifestPayload | null;
  revisions: RecordRevision[];
  reports: DetectionInputReport[];
  custodianWallets?: string[];
  thresholdK?: number;
}

const NEGATIVE_VERDICTS: GroundReportVerdict[] = [
  'DAMAGED',
  'EXPIRED',
  'SHORT_QUANTITY',
  'NOT_RECEIVED',
];

const POSITIVE_STATUSES = ['DELIVERED', 'ALL_GOOD_DELIVERED'];

/**
 * Pure, deterministic detection engine incorporating:
 * 1. Independent reporter deduplication (same wallet only counts once toward K)
 * 2. Custodian report exclusion (reports from past/current custodians are marked and excluded from K)
 * 3. Manifest tampering detection (flagging modifications to immutable fields)
 * 4. Quantity reconciliation check
 * 5. Neutral non-accusatory language
 */
export function detectCoverUp(input: DetectionInput): CoverUpDetectionResult {
  const {
    currentRecord,
    manifest,
    revisions,
    reports,
    custodianWallets = [],
    thresholdK = DETECTION_CONFIG.INDEPENDENT_REPORTER_THRESHOLD_K,
  } = input;

  const normalizedCustodians = new Set(custodianWallets.map((w) => w.toLowerCase()));

  // 1. Filter negative reports and identify independent non-custodian reporters
  const negativeReports = reports.filter((r) => NEGATIVE_VERDICTS.includes(r.payload.verdict));

  const independentReporterWallets = new Set<string>();
  const independentReports: DetectionInputReport[] = [];
  const custodianNegativeReports: DetectionInputReport[] = [];

  for (const rep of negativeReports) {
    const reporterLower = rep.creator.toLowerCase();
    const isCustodian = normalizedCustodians.has(reporterLower);

    if (isCustodian) {
      custodianNegativeReports.push(rep);
    } else {
      if (!independentReporterWallets.has(reporterLower)) {
        independentReporterWallets.add(reporterLower);
      }
      independentReports.push(rep);
    }
  }

  const distinctIndependentCount = independentReporterWallets.size;
  const evidences: CoverUpEvidence[] = [];

  let statusReversalCount = 0;
  let reverseTimingFlag = false;
  let hasTampering = false;

  // 2. Check for Tampering against Dispatch Manifest (Item 2)
  if (manifest) {
    const tamperedFields: string[] = [];
    if (currentRecord.kind !== manifest.kind) tamperedFields.push('kind');
    if (currentRecord.quantity_dispatched !== manifest.quantity_dispatched) tamperedFields.push('quantity_dispatched');
    if (currentRecord.origin !== manifest.origin) tamperedFields.push('origin');
    if (currentRecord.destination !== manifest.destination) tamperedFields.push('destination');
    if (manifest.expiry_date && currentRecord.expiry_date !== manifest.expiry_date) {
      tamperedFields.push('expiry_date');
    }

    if (tamperedFields.length > 0) {
      hasTampering = true;
      evidences.push({
        ruleId: 'TAMPERING_MANIFEST_DISCREPANCY',
        findingType: 'TAMPERING',
        description: `Immutable manifest discrepancy: Current record fields [${tamperedFields.join(', ')}] differ from the original dispatch manifest.`,
        suspiciousEditBlock: revisions[revisions.length - 1]?.blockNumber || 0n,
        suspiciousEditTxHash: revisions[revisions.length - 1]?.txHash || '0x',
        custodianWallet: revisions[revisions.length - 1]?.updater || 'Unknown',
        tamperedFields,
        contradictingReports: [],
      });
    }
  }

  // 3. Inspect historical revisions for status flips & unauthorized field changes
  const sortedRevisions = [...revisions].sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));
  let prevStatus: string | undefined = undefined;
  let prevDispatched: number | undefined = undefined;

  for (const rev of sortedRevisions) {
    const newStatus = rev.status || rev.rawPayload?.status;
    const newDispatched = rev.rawPayload?.quantity_dispatched;

    // Check if quantity_dispatched was altered in a patch revision
    if (prevDispatched !== undefined && newDispatched !== undefined && newDispatched !== prevDispatched) {
      hasTampering = true;
      evidences.push({
        ruleId: 'TAMPERING_DISPATCH_QUANTITY_ALTERED',
        findingType: 'TAMPERING',
        description: `Quantity dispatched was modified on-chain at block #${rev.blockNumber.toString()} from ${prevDispatched} to ${newDispatched}.`,
        suspiciousEditBlock: rev.blockNumber,
        suspiciousEditTxHash: rev.txHash,
        custodianWallet: rev.updater,
        tamperedFields: ['quantity_dispatched'],
        contradictingReports: [],
      });
    }
    if (newDispatched !== undefined) prevDispatched = newDispatched;

    if (newStatus && prevStatus && newStatus !== prevStatus) {
      const isFlippingToPositive =
        POSITIVE_STATUSES.includes(newStatus) && !POSITIVE_STATUSES.includes(prevStatus);

      if (isFlippingToPositive) {
        statusReversalCount++;

        // Rule 1: Flipped to positive while >= K independent reporters filed negative reports
        if (distinctIndependentCount >= thresholdK) {
          evidences.push({
            ruleId: 'COVER_UP_STATUS_FLIP_CONTRADICTED',
            findingType: 'COVER_UP',
            description: `At block #${rev.blockNumber.toString()}, status was updated from ${prevStatus} to ${newStatus}, while ${distinctIndependentCount} independent citizen report(s) contradict the recorded status.`,
            suspiciousEditBlock: rev.blockNumber,
            suspiciousEditTxHash: rev.txHash,
            custodianWallet: rev.updater,
            oldStatus: prevStatus,
            newStatus: newStatus,
            contradictingReports: independentReports.map((nr) => ({
              reportKey: nr.key,
              blockNumber: nr.blockNumber,
              txHash: nr.txHash,
              reporter: nr.creator,
              verdict: nr.payload.verdict,
              severity: nr.payload.severity,
              description: nr.payload.description,
              photo_cids: nr.payload.photo_cids || [],
              is_custodian_submission: false,
            })),
          });
        }

        // Rule 2: Reverse-Timing Contradiction
        const reportsPriorToEdit = independentReports.filter(
          (nr) => nr.blockNumber <= rev.blockNumber
        );

        if (reportsPriorToEdit.length > 0) {
          reverseTimingFlag = true;
          const alreadyAdded = evidences.some(
            (e) => e.suspiciousEditBlock === rev.blockNumber && e.ruleId.startsWith('COVER_UP')
          );
          if (!alreadyAdded) {
            evidences.push({
              ruleId: 'COVER_UP_REVERSE_TIMING_CONTRADICTION',
              findingType: 'COVER_UP',
              description: `Status was updated to ${newStatus} at block #${rev.blockNumber.toString()} after ${reportsPriorToEdit.length} independent report(s) had already documented failures.`,
              suspiciousEditBlock: rev.blockNumber,
              suspiciousEditTxHash: rev.txHash,
              custodianWallet: rev.updater,
              oldStatus: prevStatus,
              newStatus: newStatus,
              contradictingReports: reportsPriorToEdit.map((nr) => ({
                reportKey: nr.key,
                blockNumber: nr.blockNumber,
                txHash: nr.txHash,
                reporter: nr.creator,
                verdict: nr.payload.verdict,
                severity: nr.payload.severity,
                description: nr.payload.description,
                photo_cids: nr.payload.photo_cids || [],
                is_custodian_submission: false,
              })),
            });
          }
        }
      }
    }

    if (newStatus) prevStatus = newStatus;
  }

  // Check current status if single revision with >= K independent reports
  if (
    POSITIVE_STATUSES.includes(currentRecord.status) &&
    distinctIndependentCount >= thresholdK &&
    !evidences.some((e) => e.findingType === 'COVER_UP')
  ) {
    const latestRev = sortedRevisions[sortedRevisions.length - 1];
    evidences.push({
      ruleId: 'COVER_UP_CURRENT_STATUS_CONTRADICTION',
      findingType: 'COVER_UP',
      description: `Official record status is recorded as ${currentRecord.status}, which contradicts ${distinctIndependentCount} independent ground reality reports.`,
      suspiciousEditBlock: latestRev ? latestRev.blockNumber : 0n,
      suspiciousEditTxHash: latestRev ? latestRev.txHash : '0x',
      custodianWallet: latestRev ? latestRev.updater : 'Unknown',
      oldStatus: 'PREVIOUS',
      newStatus: currentRecord.status,
      contradictingReports: independentReports.map((nr) => ({
        reportKey: nr.key,
        blockNumber: nr.blockNumber,
        txHash: nr.txHash,
        reporter: nr.creator,
        verdict: nr.payload.verdict,
        severity: nr.payload.severity,
        description: nr.payload.description,
        photo_cids: nr.payload.photo_cids || [],
        is_custodian_submission: false,
      })),
    });
  }

  // 4. Quantity Reconciliation Check
  const quantityDispatched = currentRecord.quantity_dispatched || 0;
  const quantityReceived = currentRecord.quantity_received || 0;
  let quantityGap = 0;

  if (quantityReceived > quantityDispatched && quantityDispatched > 0) {
    quantityGap = quantityReceived - quantityDispatched;
    evidences.push({
      ruleId: 'RECONCILIATION_CLAIMED_EXCEEDS_DISPATCHED',
      findingType: 'COVER_UP',
      description: `Reconciliation discrepancy: Claimed received (${quantityReceived}) exceeds dispatched quantity (${quantityDispatched}).`,
      suspiciousEditBlock: sortedRevisions[sortedRevisions.length - 1]?.blockNumber || 0n,
      suspiciousEditTxHash: sortedRevisions[sortedRevisions.length - 1]?.txHash || '0x',
      custodianWallet: sortedRevisions[sortedRevisions.length - 1]?.updater || 'Unknown',
      quantityGap,
      contradictingReports: [],
    });
  }

  // 5. Score Calculation using Constants
  const reporterWeight = Math.min(
    DETECTION_CONFIG.WEIGHTS.INDEPENDENT_REPORTERS_MAX,
    distinctIndependentCount * 10
  );

  const avgSeverity =
    independentReports.length > 0
      ? independentReports.reduce((acc, r) => acc + (r.payload.severity || 0), 0) /
        independentReports.length
      : 0;
  const severityWeight = Math.min(
    DETECTION_CONFIG.WEIGHTS.AVERAGE_SEVERITY_MAX,
    Math.round((avgSeverity / 10) * DETECTION_CONFIG.WEIGHTS.AVERAGE_SEVERITY_MAX)
  );

  const reversalWeight = Math.min(
    DETECTION_CONFIG.WEIGHTS.STATUS_REVERSAL_MAX,
    statusReversalCount * 25
  );
  const timingWeight = reverseTimingFlag ? DETECTION_CONFIG.WEIGHTS.REVERSE_TIMING_MAX : 0;
  const gapWeight = quantityGap > 0 ? DETECTION_CONFIG.WEIGHTS.QUANTITY_GAP_MAX : 0;
  const tamperingWeight = hasTampering ? DETECTION_CONFIG.WEIGHTS.TAMPERING_MAX : 0;

  const totalScore = Math.min(
    100,
    reporterWeight + severityWeight + reversalWeight + timingWeight + gapWeight + tamperingWeight
  );

  // A cover-up finding requires at least thresholdK independent reporters OR explicit quantity manipulation
  const hasCoverUpEvidence = evidences.some((e) => e.findingType === 'COVER_UP');
  const isCoverUp = (hasCoverUpEvidence && distinctIndependentCount >= thresholdK) || (quantityGap > 0);

  let alertMessage: string | undefined;
  if (isCoverUp && evidences.length > 0) {
    const primary = evidences.find((e) => e.findingType === 'COVER_UP') || evidences[0];
    alertMessage = `ALERT: At block #${primary.suspiciousEditBlock.toString()}, status was changed from ${
      primary.oldStatus || 'DAMAGED'
    } to ${primary.newStatus || currentRecord.status}, while ${
      primary.contradictingReports.length
    } independent citizen report(s) contradict the recorded status.`;
  } else if (hasTampering) {
    alertMessage = `ALERT: Tampering detected: Core parameters differ from original immutable manifest.`;
  }

  return {
    isCoverUp,
    hasTampering,
    score: totalScore,
    scoreBreakdown: {
      independentReportersWeight: reporterWeight,
      averageSeverityWeight: severityWeight,
      statusReversalWeight: reversalWeight,
      reverseTimingWeight: timingWeight,
      quantityGapWeight: gapWeight,
      tamperingWeight,
      formula:
        'Score (0-100) = Independent Reporters (max 30) + Avg Severity (max 25) + Status Reversals (max 25) + Reverse Timing (max 10) + Quantity Gap (max 10) + Tampering (max 40)',
    },
    alertMessage,
    evidences,
  };
}
