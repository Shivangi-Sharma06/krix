import { describe, it, expect } from 'vitest';
import { detectCoverUp, buildClaimsLadder, type DetectionInput } from './detect';
import type { CivicRecordPayload, RecordRevision, GroundReportPayload, DispatchManifestPayload } from './types';

const baseRecord: CivicRecordPayload = {
  type: 'civic_record',
  reference_code: 'KX-MED-GNT-2026-ABC123',
  kind: 'MEDICINE_BATCH',
  title: '500 Dengue Testing Kits',
  quantity_dispatched: 500,
  quantity_received: 500,
  status: 'ALL_GOOD_DELIVERED',
  origin: 'State Warehouse, Vijayawada',
  destination: 'PHC Mangalagiri',
  district: 'Guntur',
  ward_id: 'W-12',
  notes: 'All items verified',
};

const baseManifest: DispatchManifestPayload = {
  type: 'dispatch_manifest',
  record_entity_key: '0x1111111111111111111111111111111111111111111111111111111111111111',
  reference_code: 'KX-MED-GNT-2026-ABC123',
  kind: 'MEDICINE_BATCH',
  quantity_dispatched: 500,
  origin: 'State Warehouse, Vijayawada',
  destination: 'PHC Mangalagiri',
  creator_wallet: '0xaaaa',
};

const baseRevisions: RecordRevision[] = [
  { blockNumber: 100n, txHash: '0x1', updater: '0xaaaa', type: 'CREATED', status: 'CREATED' },
  { blockNumber: 110n, txHash: '0x2', updater: '0xbbbb', type: 'PATCHED', status: 'DAMAGED' },
  { blockNumber: 130n, txHash: '0x3', updater: '0xcccc', type: 'PATCHED', status: 'ALL_GOOD_DELIVERED' },
];

describe('Detection Engine Hardening (lib/detect.ts)', () => {
  it('1. Flags cover-up when 3 distinct independent reporters file negative reports', () => {
    const reports = [
      {
        key: '0xrep1',
        blockNumber: 115n,
        txHash: '0xt1',
        creator: '0x1111',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 9,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Cartons soaked',
          photo_cids: [],
          reporter_role: 'DOCTOR' as const,
        },
      },
      {
        key: '0xrep2',
        blockNumber: 118n,
        txHash: '0xt2',
        creator: '0x2222',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Seals broken',
          photo_cids: [],
          reporter_role: 'INSPECTOR' as const,
        },
      },
      {
        key: '0xrep3',
        blockNumber: 120n,
        txHash: '0xt3',
        creator: '0x3333',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Shortage and broken vials',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
    ];

    const res = detectCoverUp({
      currentRecord: baseRecord,
      manifest: baseManifest,
      revisions: baseRevisions,
      reports,
      custodianWallets: ['0xaaaa', '0xbbbb', '0xcccc'],
    });

    expect(res.isCoverUp).toBe(true);
    expect(res.alertMessage).toContain('contradict the recorded status');
  });

  it('2. Does NOT flag when only 2 independent reports exist (below threshold K=3)', () => {
    const reports = [
      {
        key: '0xrep1',
        blockNumber: 115n,
        txHash: '0xt1',
        creator: '0x1111',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 9,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Cartons soaked',
          photo_cids: [],
          reporter_role: 'DOCTOR' as const,
        },
      },
      {
        key: '0xrep2',
        blockNumber: 118n,
        txHash: '0xt2',
        creator: '0x2222',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Seals broken',
          photo_cids: [],
          reporter_role: 'INSPECTOR' as const,
        },
      },
    ];

    const res = detectCoverUp({
      currentRecord: baseRecord,
      manifest: baseManifest,
      revisions: baseRevisions,
      reports,
      custodianWallets: ['0xaaaa', '0xbbbb', '0xcccc'],
    });

    expect(res.isCoverUp).toBe(false);
  });

  it('3. Does NOT flag when 3 reports come from the SAME wallet (counts as 1 independent reporter)', () => {
    const sameWallet = '0x1111';
    const reports = [
      {
        key: '0xrep1',
        blockNumber: 115n,
        txHash: '0xt1',
        creator: sameWallet,
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 9,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Report 1 from same wallet',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
      {
        key: '0xrep2',
        blockNumber: 118n,
        txHash: '0xt2',
        creator: sameWallet,
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Report 2 from same wallet',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
      {
        key: '0xrep3',
        blockNumber: 120n,
        txHash: '0xt3',
        creator: sameWallet,
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Report 3 from same wallet',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
    ];

    const res = detectCoverUp({
      currentRecord: baseRecord,
      manifest: baseManifest,
      revisions: baseRevisions,
      reports,
      custodianWallets: ['0xaaaa', '0xbbbb', '0xcccc'],
    });

    // 3 reports from 1 wallet count as 1 independent reporter, below threshold K=3
    expect(res.isCoverUp).toBe(false);
  });

  it('4. Excludes reports submitted by custodians from the independent count', () => {
    const custodianWallet = '0xcccc'; // Current custodian
    const reports = [
      {
        key: '0xrep1',
        blockNumber: 115n,
        txHash: '0xt1',
        creator: custodianWallet, // Submitter is custodian!
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 9,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Custodian filed this',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
      {
        key: '0xrep2',
        blockNumber: 118n,
        txHash: '0xt2',
        creator: '0x2222',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Independent report',
          photo_cids: [],
          reporter_role: 'INSPECTOR' as const,
        },
      },
      {
        key: '0xrep3',
        blockNumber: 120n,
        txHash: '0xt3',
        creator: '0x3333',
        payload: {
          type: 'ground_report' as const,
          record_entity_key: '0xrec' as any,
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Independent report',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
    ];

    const res = detectCoverUp({
      currentRecord: baseRecord,
      manifest: baseManifest,
      revisions: baseRevisions,
      reports,
      custodianWallets: ['0xaaaa', '0xbbbb', custodianWallet],
    });

    // Only 2 independent reporters (0x2222, 0x3333) -> Not a coverup under Rule 1
    expect(res.isCoverUp).toBe(false);
  });

  it('5. Flags TAMPERING if quantity_dispatched is altered in a revision', () => {
    const tamperingRevisions: RecordRevision[] = [
      { blockNumber: 100n, txHash: '0x1', updater: '0xaaaa', type: 'CREATED', rawPayload: { quantity_dispatched: 500 } },
      { blockNumber: 120n, txHash: '0x2', updater: '0xbbbb', type: 'PATCHED', rawPayload: { quantity_dispatched: 300 } }, // Tampered!
    ];

    const res = detectCoverUp({
      currentRecord: { ...baseRecord, quantity_dispatched: 300 },
      manifest: baseManifest,
      revisions: tamperingRevisions,
      reports: [],
    });

    expect(res.hasTampering).toBe(true);
    expect(res.evidences.some((e) => e.findingType === 'TAMPERING')).toBe(true);
  });

  it('6. Flags TAMPERING if current record values differ from dispatch manifest', () => {
    const tamperedRecord = {
      ...baseRecord,
      origin: 'Fake Warehouse, Nowhere', // Altered!
    };

    const res = detectCoverUp({
      currentRecord: tamperedRecord,
      manifest: baseManifest,
      revisions: [baseRevisions[0]],
      reports: [],
    });

    expect(res.hasTampering).toBe(true);
    expect(res.evidences.some((e) => e.findingType === 'TAMPERING')).toBe(true);
  });

  it('7. Returns no flags for a completely clean record with no reports', () => {
    const cleanRecord: CivicRecordPayload = {
      ...baseRecord,
      status: 'DELIVERED',
      quantity_received: 500,
    };

    const res = detectCoverUp({
      currentRecord: cleanRecord,
      manifest: baseManifest,
      revisions: [
        { blockNumber: 100n, txHash: '0x1', updater: '0xaaaa', type: 'CREATED', status: 'CREATED' },
        { blockNumber: 110n, txHash: '0x2', updater: '0xbbbb', type: 'PATCHED', status: 'IN_TRANSIT' },
        { blockNumber: 120n, txHash: '0x3', updater: '0xcccc', type: 'PATCHED', status: 'DELIVERED' },
      ],
      reports: [],
    });

    expect(res.isCoverUp).toBe(false);
    expect(res.hasTampering).toBe(false);
    expect(res.score).toBeLessThan(50);
    expect(res.evidences.length).toBe(0);
  });
});

describe('Claims Ladder Detection Rules (lib/detect.ts -> buildClaimsLadder)', () => {
  it('1. Matching counts produce no numbers-differ flag', () => {
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            passed_on_count: 500,
            condition: 'OK',
            note: 'All 500 items accounted for',
            photo_cids: [],
          },
        },
        {
          key: '0xst2',
          blockNumber: 120n,
          txHash: '0xstx2',
          creator: '0xclinic',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'FACILITY_STAFF',
            location: 'PHC Mangalagiri',
            received_count: 500,
            condition: 'OK',
            note: 'All 500 received in clinic',
            photo_cids: [],
          },
        },
      ],
    });

    const numberDiffFindings = ladder.findings.filter((f) => f.type === 'NUMBERS_DIFFER');
    expect(numberDiffFindings.length).toBe(0);
  });

  it('2. Count drop without explanation flags "numbers differ"', () => {
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            passed_on_count: 500,
            condition: 'OK',
            note: 'Handled 500 units',
            photo_cids: [],
          },
        },
        {
          key: '0xst2',
          blockNumber: 120n,
          txHash: '0xstx2',
          creator: '0xclinic',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'FACILITY_STAFF',
            location: 'PHC Mangalagiri',
            received_count: 350, // 150 drop without explanation!
            condition: 'OK',
            note: 'Stock checked in without comment',
            photo_cids: [],
          },
        },
      ],
    });

    const numberDiffFindings = ladder.findings.filter((f) => f.type === 'NUMBERS_DIFFER');
    expect(numberDiffFindings.length).toBe(1);
    expect(numberDiffFindings[0].difference).toBe(150);
    expect(numberDiffFindings[0].blockTimes?.earlierBlock).toBe(110n);
    expect(numberDiffFindings[0].blockTimes?.laterBlock).toBe(120n);
  });

  it('3. Count drop with an explaining statement or response does NOT flag numbers differ', () => {
    // Explanation in note
    const ladderWithNoteExplanation = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            passed_on_count: 500,
            condition: 'OK',
            note: 'Handled 500 units',
            photo_cids: [],
          },
        },
        {
          key: '0xst2',
          blockNumber: 120n,
          txHash: '0xstx2',
          creator: '0xclinic',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'FACILITY_STAFF',
            location: 'PHC Mangalagiri',
            received_count: 350,
            condition: 'DAMAGED',
            note: 'Boxes wet from rain, damage and loss of 150 vials observed',
            photo_cids: [],
          },
        },
      ],
    });

    const findingsNote = ladderWithNoteExplanation.findings.filter((f) => f.type === 'NUMBERS_DIFFER');
    expect(findingsNote.length).toBe(0);

    // Explanation via official authority response
    const ladderWithResponseExplanation = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            passed_on_count: 500,
            condition: 'OK',
            note: 'Handled 500 units',
            photo_cids: [],
          },
        },
        {
          key: '0xst2',
          blockNumber: 125n,
          txHash: '0xstx2',
          creator: '0xclinic',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'FACILITY_STAFF',
            location: 'PHC Mangalagiri',
            received_count: 350,
            condition: 'OK',
            note: 'Received batch',
            photo_cids: [],
          },
        },
      ],
      responses: [
        {
          key: '0xresp1',
          blockNumber: 122n,
          txHash: '0xrtx1',
          creator: '0xaaaa',
          payload: {
            type: 'authority_response',
            record_entity_key: '0xrec' as any,
            target_key: '0xst1' as any,
            target_type: 'statement',
            response_text: 'Transit loss of 150 units reported and replaced by sub-depot.',
          },
        },
      ],
    });

    const findingsResp = ladderWithResponseExplanation.findings.filter((f) => f.type === 'NUMBERS_DIFFER');
    expect(findingsResp.length).toBe(0);
  });

  it('4. Zero statements with a delivered claim flags "no statement from any party"', () => {
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'DELIVERED' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [
        { blockNumber: 100n, txHash: '0x1', updater: '0xaaaa', type: 'CREATED', status: 'CREATED' },
        { blockNumber: 120n, txHash: '0x2', updater: '0xaaaa', type: 'PATCHED', status: 'DELIVERED' },
      ],
      reports: [],
      statements: [],
    });

    const noStatementFindings = ladder.findings.filter((f) => f.type === 'NO_STATEMENT');
    expect(noStatementFindings.length).toBe(1);
    expect(noStatementFindings[0].title).toBe('No statement from any party');
  });

  it('5. Same wallet duplicating statements is counted once in unique independent counts', () => {
    const sameWallet = '0xoperator99';
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: sameWallet,
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'TRANSPORT',
            location: 'in transit',
            received_count: 500,
            condition: 'OK',
            note: 'Hop 1',
            photo_cids: [],
          },
        },
        {
          key: '0xst2',
          blockNumber: 115n,
          txHash: '0xstx2',
          creator: sameWallet, // duplicate wallet
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'TRANSPORT',
            location: 'in transit',
            received_count: 500,
            condition: 'OK',
            note: 'Hop 2',
            photo_cids: [],
          },
        },
      ],
    });

    expect(ladder.totalStatements).toBe(2);
    expect(ladder.uniqueIndependentWallets).toBe(1);
    expect(ladder.claims.find((c) => c.id === '0xst2')?.isDuplicateWallet).toBe(true);
  });

  it('6. Authority-wallet statement is excluded and labelled', () => {
    const authorityWallet = '0xaaaa';
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: authorityWallet,
      custodianWallets: [authorityWallet],
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: authorityWallet, // Submitter is the authority!
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'TRANSPORT',
            location: 'in transit',
            received_count: 500,
            condition: 'OK',
            note: 'Official submitted this statement',
            photo_cids: [],
          },
        },
      ],
    });

    const stClaim = ladder.claims.find((c) => c.id === '0xst1');
    expect(stClaim?.isAuthorityWallet).toBe(true);
    expect(ladder.uniqueIndependentWallets).toBe(0);
  });

  it('7. Flags statement before promise existed as timeline anomaly', () => {
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 500n, // Genesis at 500
      recordCreatorWallet: '0xaaaa',
      revisions: [],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 450n, // Statement at 450 (before genesis)
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            condition: 'OK',
            note: 'Premature claim',
            photo_cids: [],
          },
        },
      ],
    });

    const anomaly = ladder.findings.filter((f) => f.type === 'TIMELINE_ANOMALY');
    expect(anomaly.length).toBe(1);
    expect(anomaly[0].title).toBe('Statement recorded before promise creation');
    expect(anomaly[0].description).toContain('predates');
  });

  it('8. Clean record has no findings and provides the mandatory disclaimer', () => {
    const ladder = buildClaimsLadder({
      currentRecord: { ...baseRecord, status: 'IN_TRANSIT' },
      recordCreatedAtBlock: 100n,
      recordCreatorWallet: '0xaaaa',
      revisions: [baseRevisions[0]],
      reports: [],
      statements: [
        {
          key: '0xst1',
          blockNumber: 110n,
          txHash: '0xstx1',
          creator: '0xdistributor',
          payload: {
            type: 'statement',
            record_entity_key: '0xrec' as any,
            party_type: 'DISTRIBUTOR',
            location: 'in transit',
            received_count: 500,
            passed_on_count: 500,
            condition: 'OK',
            note: 'Normal dispatch',
            photo_cids: [],
          },
        },
      ],
    });

    expect(ladder.findings.length).toBe(0);
    expect(ladder.disclaimer).toBe(
      'Krix shows where claims disagree. It cannot prove where goods were lost or who is responsible.'
    );
  });
});
