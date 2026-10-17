import type {
  CivicRecordPayload,
  GroundReportPayload,
  RecordRevision,
  CoverUpDetectionResult,
  CoverUpEvidence,
  GroundReportVerdict,
  DispatchManifestPayload,
  StatementPayload,
  AuthorityResponsePayload,
  ClaimsLadderResult,
  LadderClaimEntry,
  LadderFinding,
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

export interface DetectionInputStatement {
  key?: string;
  blockNumber: bigint;
  txHash: string;
  creator: string;
  payload: StatementPayload;
}

export interface DetectionInputAuthorityResponse {
  key?: string;
  blockNumber: bigint;
  txHash: string;
  creator: string;
  payload: AuthorityResponsePayload;
}

export interface ClaimsLadderInput {
  currentRecord: CivicRecordPayload;
  recordCreatedAtBlock?: bigint;
  recordCreatorWallet?: string;
  revisions: RecordRevision[];
  reports: DetectionInputReport[];
  statements: DetectionInputStatement[];
  responses?: DetectionInputAuthorityResponse[];
  custodianWallets?: string[];
}

/**
 * Builds the Claims Ladder and evaluates cross-party claims rules:
 * - Orders claims side by side by block time
 * - Identifies authority claims, statements, citizen reports
 * - Flags count drop without explanation: "numbers differ"
 * - Flags "no statement from any party" when delivered claimed with zero statements and zero independent witnesses
 * - Flags "authority claims delivered, statement says damaged/short"
 * - Flags "statement says delayed, authority claims delivered earlier"
 * - Flags timeline anomaly if statement created before promise genesis
 * - Excludes and labels statements from authority's own wallets or duplicate wallets
 * - Always includes neutral disclaimer
 */
export function buildClaimsLadder(input: ClaimsLadderInput): ClaimsLadderResult {
  const {
    currentRecord,
    recordCreatedAtBlock = 0n,
    recordCreatorWallet = '',
    revisions,
    reports,
    statements,
    responses = [],
    custodianWallets = [],
  } = input;

  const authorityWallets = new Set<string>(
    [
      recordCreatorWallet,
      ...custodianWallets,
      ...revisions.map((r) => r.updater),
    ]
      .filter(Boolean)
      .map((w) => w.toLowerCase())
  );

  const claims: LadderClaimEntry[] = [];
  const seenWallets = new Set<string>();

  // 1. Authority Claims from Revisions / Genesis
  if (revisions.length === 0) {
    claims.push({
      id: 'auth-genesis',
      source: 'AUTHORITY',
      blockNumber: recordCreatedAtBlock,
      txHash: '0xgenesis',
      wallet: recordCreatorWallet || '0xauthority',
      isAuthorityWallet: true,
      isDuplicateWallet: false,
      partyType: 'AUTHORITY',
      claimedQuantity: currentRecord.quantity_dispatched,
      receivedCount: currentRecord.quantity_received,
      statusClaim: currentRecord.status,
      notes: currentRecord.notes,
      location: currentRecord.origin,
    });
    if (recordCreatorWallet) seenWallets.add(recordCreatorWallet.toLowerCase());
  } else {
    for (let i = 0; i < revisions.length; i++) {
      const rev = revisions[i];
      claims.push({
        id: `auth-rev-${i}`,
        source: 'AUTHORITY',
        blockNumber: rev.blockNumber,
        txHash: rev.txHash,
        wallet: rev.updater,
        isAuthorityWallet: true,
        isDuplicateWallet: false,
        partyType: 'AUTHORITY',
        claimedQuantity: rev.rawPayload?.quantity_dispatched ?? currentRecord.quantity_dispatched,
        receivedCount: rev.quantity_received ?? (i === 0 ? 0 : undefined),
        statusClaim: rev.status || rev.rawPayload?.status,
        notes: rev.notes || rev.rawPayload?.notes,
        location: rev.rawPayload?.origin || currentRecord.origin,
      });
      if (rev.updater) seenWallets.add(rev.updater.toLowerCase());
    }
  }

  // 2. Statements from Intermediary / Facility Parties
  for (const st of statements) {
    const creatorLower = st.creator.toLowerCase();
    const isAuth = authorityWallets.has(creatorLower);
    const isDup = !isAuth && seenWallets.has(creatorLower);
    if (!isAuth && !isDup) {
      seenWallets.add(creatorLower);
    }

    claims.push({
      id: st.key || `st-${st.txHash.slice(0, 10)}`,
      source: 'STATEMENT',
      blockNumber: st.blockNumber,
      txHash: st.txHash,
      wallet: st.creator,
      isAuthorityWallet: isAuth,
      isDuplicateWallet: isDup,
      partyType: st.payload.party_type,
      receivedCount: st.payload.received_count,
      passedOnCount: st.payload.passed_on_count,
      condition: st.payload.condition,
      location: st.payload.location,
      notes: st.payload.note,
      photoCids: st.payload.photo_cids,
      rawEntityKey: st.key,
    });
  }

  // 3. Citizen Reports / Witnesses
  for (const rp of reports) {
    const creatorLower = rp.creator.toLowerCase();
    const isAuth = authorityWallets.has(creatorLower);
    const isDup = !isAuth && seenWallets.has(creatorLower);
    if (!isAuth && !isDup) {
      seenWallets.add(creatorLower);
    }

    const reportKeyLower = (rp.key || '').toLowerCase();
    const matched = responses
      .filter((res) => res.payload.target_key && res.payload.target_key.toLowerCase() === reportKeyLower)
      .map((res) => ({
        key: res.key || res.txHash,
        text: res.payload.response_text,
        officialRole: res.payload.official_role,
        blockNumber: res.blockNumber,
        txHash: res.txHash,
        wallet: res.creator,
      }));

    claims.push({
      id: rp.key || `rp-${rp.txHash.slice(0, 10)}`,
      source: 'CITIZEN_REPORT',
      blockNumber: rp.blockNumber,
      txHash: rp.txHash,
      wallet: rp.creator,
      isAuthorityWallet: isAuth,
      isDuplicateWallet: isDup,
      partyType: rp.payload.reporter_role,
      receivedCount: rp.payload.count_received,
      condition: rp.payload.verdict,
      location: rp.payload.location || undefined,
      notes: rp.payload.description,
      photoCids: rp.payload.photo_cids,
      rawEntityKey: rp.key,
      matchedResponses: matched.length > 0 ? matched : undefined,
    });
  }

  // 4. Authority Responses
  for (const resp of responses) {
    claims.push({
      id: resp.key || `resp-${resp.txHash.slice(0, 10)}`,
      source: 'AUTHORITY_RESPONSE',
      blockNumber: resp.blockNumber,
      txHash: resp.txHash,
      wallet: resp.creator,
      isAuthorityWallet: true,
      isDuplicateWallet: false,
      partyType: 'AUTHORITY',
      notes: resp.payload.response_text,
      rawEntityKey: resp.key,
      targetKey: resp.payload.target_key,
      targetType: resp.payload.target_type,
      officialRole: resp.payload.official_role,
    });
  }

  // Order all claims by blockNumber ascending
  claims.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));

  // Determine unique independent wallets (excluding authority wallets and duplicates)
  const independentWalletsSet = new Set<string>();
  for (const c of claims) {
    if (!c.isAuthorityWallet) {
      independentWalletsSet.add(c.wallet.toLowerCase());
    }
  }

  const findings: LadderFinding[] = [];

  // Finding 1: Timeline Anomaly (Statement before promise genesis)
  for (const st of statements) {
    if (recordCreatedAtBlock > 0n && st.blockNumber < recordCreatedAtBlock) {
      findings.push({
        ruleId: 'STATEMENT_BEFORE_PROMISE_GENESIS',
        type: 'TIMELINE_ANOMALY',
        severity: 'ALERT',
        title: 'Statement recorded before promise creation',
        description: `Statement from ${st.payload.party_type} at block #${st.blockNumber.toString()} predates the creation of this promise at block #${recordCreatedAtBlock.toString()}.`,
        blockTimes: { earlierBlock: st.blockNumber, laterBlock: recordCreatedAtBlock },
        involvedWallets: [st.creator],
      });
    }
  }

  // Finding 2: "numbers differ"
  // When a later statement's received_count is lower than an earlier claimed count
  // with no statement or response on record explaining it.
  const orderedValidStatements = claims.filter(
    (c) => c.source === 'STATEMENT' && !c.isAuthorityWallet
  );

  for (let i = 0; i < orderedValidStatements.length; i++) {
    const currentSt = orderedValidStatements[i];
    if (currentSt.receivedCount === undefined) continue;

    // Compare against earlier statements that had a count
    for (let j = 0; j < i; j++) {
      const earlierSt = orderedValidStatements[j];
      const earlierCount = earlierSt.passedOnCount ?? earlierSt.receivedCount;
      if (earlierCount !== undefined && currentSt.receivedCount < earlierCount) {
        // Check if there is an explanation:
        // A statement or response between earlier and current or in currentSt note detailing damage/shortage/explanation
        const explanationInNote =
          currentSt.notes &&
          currentSt.notes.trim().length > 0 &&
          (currentSt.condition === 'DAMAGED' ||
            currentSt.condition === 'SHORT' ||
            currentSt.condition === 'EXPIRED' ||
            /damage|leak|spill|accident|short|lost|break|theft|mishap|delay/i.test(currentSt.notes));

        const hasExplainingResponse = responses.some(
          (r) =>
            r.blockNumber >= earlierSt.blockNumber &&
            r.blockNumber <= currentSt.blockNumber &&
            /damage|transit|loss|short|reconcil|replac/i.test(r.payload.response_text)
        );

        if (!explanationInNote && !hasExplainingResponse) {
          const diff = earlierCount - currentSt.receivedCount;
          findings.push({
            ruleId: `NUMBERS_DIFFER_${earlierSt.id}_${currentSt.id}`,
            type: 'NUMBERS_DIFFER',
            severity: 'WARNING',
            title: 'Numbers differ without explanation on record',
            description: `At block #${currentSt.blockNumber.toString()}, party (${currentSt.partyType}) recorded ${currentSt.receivedCount} received, which is ${diff} lower than the earlier count of ${earlierCount} at block #${earlierSt.blockNumber.toString()} with no explanatory statement or official response on record.`,
            blockTimes: { earlierBlock: earlierSt.blockNumber, laterBlock: currentSt.blockNumber },
            difference: diff,
            involvedWallets: [earlierSt.wallet, currentSt.wallet],
          });
        }
      }
    }
  }

  // Finding 3: "no statement from any party"
  // When the authority claims delivered but there are zero statements and zero independent witnesses.
  const authorityDeliveredClaim = claims.find(
    (c) =>
      c.source === 'AUTHORITY' &&
      c.statusClaim &&
      POSITIVE_STATUSES.includes(c.statusClaim)
  );

  const independentStatements = statements.filter(
    (s) => !authorityWallets.has(s.creator.toLowerCase())
  );
  const independentReports = reports.filter(
    (r) => !authorityWallets.has(r.creator.toLowerCase())
  );

  if (
    authorityDeliveredClaim &&
    independentStatements.length === 0 &&
    independentReports.length === 0
  ) {
    findings.push({
      ruleId: 'NO_STATEMENT_FROM_ANY_PARTY',
      type: 'NO_STATEMENT',
      severity: 'WARNING',
      title: 'No statement from any party',
      description: `Authority claims status as ${authorityDeliveredClaim.statusClaim} at block #${authorityDeliveredClaim.blockNumber.toString()}, but there are zero statements from intermediary parties and zero independent citizen reports on record.`,
      blockTimes: { earlierBlock: authorityDeliveredClaim.blockNumber, laterBlock: authorityDeliveredClaim.blockNumber },
      involvedWallets: [authorityDeliveredClaim.wallet],
    });
  }

  // Finding 4: "authority claims delivered, statement says damaged/short"
  if (authorityDeliveredClaim) {
    const damagedOrShortStatements = statements.filter(
      (s) => s.payload.condition === 'DAMAGED' || s.payload.condition === 'SHORT'
    );
    if (damagedOrShortStatements.length > 0) {
      const st = damagedOrShortStatements[0];
      findings.push({
        ruleId: 'AUTHORITY_DELIVERED_STATEMENT_DEFECT',
        type: 'CONDITION_CONTRADICTION',
        severity: 'ALERT',
        title: 'Authority claims delivered while statement records defect',
        description: `Authority claims status ${authorityDeliveredClaim.statusClaim} at block #${authorityDeliveredClaim.blockNumber.toString()}, while party statement from ${st.payload.party_type} at block #${st.blockNumber.toString()} reports condition as ${st.payload.condition}.`,
        blockTimes: { earlierBlock: authorityDeliveredClaim.blockNumber, laterBlock: st.blockNumber },
        involvedWallets: [authorityDeliveredClaim.wallet, st.creator],
      });
    }
  }

  // Finding 5: "statement says delayed, authority claims delivered earlier"
  for (const st of statements) {
    if (st.payload.condition === 'DELAYED') {
      const earlierDeliveredAuth = claims.find(
        (c) =>
          c.source === 'AUTHORITY' &&
          c.statusClaim &&
          POSITIVE_STATUSES.includes(c.statusClaim) &&
          c.blockNumber <= st.blockNumber
      );
      if (earlierDeliveredAuth) {
        findings.push({
          ruleId: `STATEMENT_DELAYED_AFTER_DELIVERY_${st.key || st.blockNumber}`,
          type: 'DELAY_CONTRADICTION',
          severity: 'WARNING',
          title: 'Statement indicates delay after delivery was claimed',
          description: `Statement from ${st.payload.party_type} at block #${st.blockNumber.toString()} reports condition as DELAYED, while authority previously recorded status ${earlierDeliveredAuth.statusClaim} at block #${earlierDeliveredAuth.blockNumber.toString()}.`,
          blockTimes: { earlierBlock: earlierDeliveredAuth.blockNumber, laterBlock: st.blockNumber },
          involvedWallets: [earlierDeliveredAuth.wallet, st.creator],
        });
      }
    }
  }

  return {
    claims,
    findings,
    uniqueIndependentWallets: independentWalletsSet.size,
    totalStatements: statements.length,
    totalCitizenReports: reports.length,
    disclaimer: DETECTION_CONFIG.LADDER_RULES.DISCLAIMER,
  };
}
