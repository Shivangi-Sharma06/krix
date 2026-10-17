import type {
  CivicRecordPayload,
  GroundReportPayload,
  RecordRevision,
  CoverUpDetectionResult,
  CoverUpEvidence,
  GroundReportVerdict,
} from './types';

export interface DetectionInputReport {
  key?: string;
  blockNumber: bigint;
  txHash: string;
  creator: string;
  payload: GroundReportPayload;
}

export interface DetectionInput {
  currentRecord: CivicRecordPayload;
  revisions: RecordRevision[];
  reports: DetectionInputReport[];
  defaultThresholdK?: number;
}

const NEGATIVE_VERDICTS: GroundReportVerdict[] = [
  'DAMAGED',
  'EXPIRED',
  'SHORT_QUANTITY',
  'NOT_RECEIVED',
];

const POSITIVE_STATUSES = ['DELIVERED', 'ALL_GOOD_DELIVERED'];

/**
 * Pure, deterministic cover-up detection algorithm implementing PRD FR-C4, FR-C6, and FR-C7.
 */
export function detectCoverUp(input: DetectionInput): CoverUpDetectionResult {
  const { currentRecord, revisions, reports, defaultThresholdK = 3 } = input;

  const negativeReports = reports.filter((r) =>
    NEGATIVE_VERDICTS.includes(r.payload.verdict)
  );

  const evidences: CoverUpEvidence[] = [];
  let statusReversalCount = 0;
  let reverseTimingFlag = false;

  // Track state transitions through ordered revisions
  const sortedRevisions = [...revisions].sort((a, b) => {
    if (a.blockNumber === b.blockNumber) return 0;
    return a.blockNumber < b.blockNumber ? -1 : 1;
  });

  let prevStatus: string | undefined = undefined;

  for (let i = 0; i < sortedRevisions.length; i++) {
    const rev = sortedRevisions[i];
    const newStatus = rev.status || rev.rawPayload?.status;

    if (newStatus && prevStatus && newStatus !== prevStatus) {
      const isFlippingToPositive =
        POSITIVE_STATUSES.includes(newStatus) && !POSITIVE_STATUSES.includes(prevStatus);

      if (isFlippingToPositive) {
        statusReversalCount++;

        // Rule 1: Flipped to positive while >= K negative reports exist
        if (negativeReports.length >= defaultThresholdK) {
          evidences.push({
            ruleId: 'RULE_1_STATUS_FLIP_WITH_NEGATIVE_REPORTS',
            description: `At block #${rev.blockNumber.toString()}, custodian ${rev.updater} changed status from ${prevStatus} to ${newStatus}, while ${negativeReports.length} immutable citizen reports say ${negativeReports.map((nr) => nr.payload.verdict).join(', ')}.`,
            suspiciousEditBlock: rev.blockNumber,
            suspiciousEditTxHash: rev.txHash,
            custodianWallet: rev.updater,
            oldStatus: prevStatus,
            newStatus: newStatus,
            contradictingReports: negativeReports.map((nr) => ({
              reportKey: nr.key,
              blockNumber: nr.blockNumber,
              txHash: nr.txHash,
              reporter: nr.creator,
              verdict: nr.payload.verdict,
              severity: nr.payload.severity,
              description: nr.payload.description,
              photo_cids: nr.payload.photo_cids || [],
            })),
          });
        }

        // Rule 2: Reverse-Timing Contradiction
        // Status changed to positive AFTER at least one negative report was already filed
        const reportsPriorToEdit = negativeReports.filter(
          (nr) => nr.blockNumber <= rev.blockNumber
        );

        if (reportsPriorToEdit.length > 0) {
          reverseTimingFlag = true;
          // Avoid duplicate evidence if rule 1 already added it for same edit
          const alreadyAdded = evidences.some(
            (e) => e.suspiciousEditBlock === rev.blockNumber
          );
          if (!alreadyAdded) {
            evidences.push({
              ruleId: 'RULE_2_REVERSE_TIMING_CONTRADICTION',
              description: `Reverse-timing contradiction: status changed to ${newStatus} at block #${rev.blockNumber.toString()} after ${reportsPriorToEdit.length} ground report(s) had already documented failures.`,
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
              })),
            });
          }
        }
      }
    }

    if (newStatus) {
      prevStatus = newStatus;
    }
  }

  // Also check if current status is positive while >= K negative reports exist, even if single revision
  if (
    POSITIVE_STATUSES.includes(currentRecord.status) &&
    negativeReports.length >= defaultThresholdK &&
    evidences.length === 0
  ) {
    const latestRev = sortedRevisions[sortedRevisions.length - 1];
    evidences.push({
      ruleId: 'RULE_1_CURRENT_POSITIVE_STATUS_CONTRADICTION',
      description: `Official record status is ${currentRecord.status}, directly contradicting ${negativeReports.length} ground reality reports.`,
      suspiciousEditBlock: latestRev ? latestRev.blockNumber : 0n,
      suspiciousEditTxHash: latestRev ? latestRev.txHash : '0x',
      custodianWallet: latestRev ? latestRev.updater : 'Unknown',
      oldStatus: 'PREVIOUS',
      newStatus: currentRecord.status,
      contradictingReports: negativeReports.map((nr) => ({
        reportKey: nr.key,
        blockNumber: nr.blockNumber,
        txHash: nr.txHash,
        reporter: nr.creator,
        verdict: nr.payload.verdict,
        severity: nr.payload.severity,
        description: nr.payload.description,
        photo_cids: nr.payload.photo_cids || [],
      })),
    });
  }

  // Rule 3: Quantity reconciliation check (FR-C6)
  // Flag when quantity_received > dispatched, or unexplained gap with reports
  const quantityDispatched = currentRecord.quantity_dispatched || 0;
  const quantityReceived = currentRecord.quantity_received || 0;
  let quantityGap = 0;

  if (quantityReceived > quantityDispatched && quantityDispatched > 0) {
    quantityGap = quantityReceived - quantityDispatched;
    evidences.push({
      ruleId: 'RULE_3_INFLATED_QUANTITY',
      description: `Quantity reconciliation mismatch: Claimed received (${quantityReceived}) exceeds total dispatched (${quantityDispatched}).`,
      suspiciousEditBlock: sortedRevisions[sortedRevisions.length - 1]?.blockNumber || 0n,
      suspiciousEditTxHash: sortedRevisions[sortedRevisions.length - 1]?.txHash || '0x',
      custodianWallet: sortedRevisions[sortedRevisions.length - 1]?.updater || 'Unknown',
      quantityGap,
      contradictingReports: [],
    });
  }

  // FR-C7: Cover-up score (0–100)
  // Formula weights:
  // - Contradicting reports count (up to 30 pts)
  // - Average severity (1-10 -> up to 25 pts)
  // - Status reversals (up to 25 pts)
  // - Reverse timing contradiction (10 pts)
  // - Quantity gap (10 pts)
  const reportCountWeight = Math.min(30, negativeReports.length * 10);

  const avgSeverity =
    negativeReports.length > 0
      ? negativeReports.reduce((acc, r) => acc + (r.payload.severity || 0), 0) /
        negativeReports.length
      : 0;
  const severityWeight = Math.min(25, Math.round((avgSeverity / 10) * 25));

  const reversalWeight = Math.min(25, statusReversalCount * 25);
  const timingWeight = reverseTimingFlag ? 10 : 0;
  const gapWeight = quantityGap > 0 ? 10 : 0;

  const totalScore = Math.min(
    100,
    reportCountWeight + severityWeight + reversalWeight + timingWeight + gapWeight
  );

  const isCoverUp = evidences.length > 0 || totalScore >= 50;

  let alertMessage: string | undefined;
  if (isCoverUp && evidences.length > 0) {
    const primary = evidences[0];
    alertMessage = `ALERT: At block #${primary.suspiciousEditBlock.toString()}, wallet ${primary.custodianWallet.slice(
      0,
      6
    )}...${primary.custodianWallet.slice(-4)} changed status from ${primary.oldStatus || 'DAMAGED'} to ${
      primary.newStatus || currentRecord.status
    }, while ${primary.contradictingReports.length} immutable citizen reports say ${
      primary.contradictingReports[0]?.verdict || 'DAMAGED'
    }.`;
  }

  return {
    isCoverUp,
    score: totalScore,
    scoreBreakdown: {
      contradictingReportsWeight: reportCountWeight,
      averageSeverityWeight: severityWeight,
      statusReversalWeight: reversalWeight,
      reverseTimingWeight: timingWeight,
      quantityGapWeight: gapWeight,
      formula:
        'Score (0-100) = Contradicting Reports (max 30) + Avg Severity (max 25) + Status Reversals (max 25) + Reverse Timing (max 10) + Quantity Gap (max 10)',
    },
    alertMessage,
    evidences,
  };
}
