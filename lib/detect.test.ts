import { describe, it, expect } from 'vitest';
import { detectCoverUp, type DetectionInput } from './detect';
import type { CivicRecordPayload, RecordRevision, GroundReportPayload, DispatchManifestPayload } from './types';

const baseRecord: CivicRecordPayload = {
  type: 'civic_record',
  reference_code: 'JA-MED-GNT-2026-ABC123',
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
  reference_code: 'JA-MED-GNT-2026-ABC123',
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
