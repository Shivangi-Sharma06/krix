import { describe, it, expect } from 'vitest';
import { detectCoverUp, type DetectionInput } from './detect';
import type { CivicRecordPayload, RecordRevision, GroundReportPayload } from './types';

describe('Cover-Up Detection Engine (lib/detect.ts)', () => {
  it('flags the seeded cover-up scenario with alert, correct block, and evidence', () => {
    // Seeded scenario:
    // Batch IND-AP-2026-04 created at block 100
    // Handed over to Clinic at block 110, marked DAMAGED
    // 3 negative citizen reports submitted at block 115, 118, 120
    // Custodian flips status to ALL_GOOD_DELIVERED at block 125
    const currentRecord: CivicRecordPayload = {
      type: 'civic_record',
      record_id: 'IND-AP-2026-04',
      kind: 'MEDICINE_BATCH',
      title: '500 Dengue Kits',
      quantity_dispatched: 500,
      quantity_received: 300,
      status: 'ALL_GOOD_DELIVERED',
      origin: 'State Warehouse, Vijayawada',
      destination: 'PHC Mangalagiri',
      district: 'Guntur',
      ward_id: 'W-12',
      notes: 'All items verified',
    };

    const revisions: RecordRevision[] = [
      {
        blockNumber: 100n,
        txHash: '0xaaa111',
        updater: '0x1111111111111111111111111111111111111111',
        type: 'CREATED',
        status: 'CREATED',
      },
      {
        blockNumber: 105n,
        txHash: '0xaaa222',
        updater: '0x2222222222222222222222222222222222222222',
        type: 'PATCHED',
        status: 'IN_TRANSIT',
      },
      {
        blockNumber: 110n,
        txHash: '0xaaa333',
        updater: '0x3333333333333333333333333333333333333333',
        type: 'PATCHED',
        status: 'DAMAGED',
      },
      {
        blockNumber: 125n,
        txHash: '0xaaa444',
        updater: '0x8a99999999999999999999999999999999999999',
        type: 'PATCHED',
        status: 'ALL_GOOD_DELIVERED',
      },
    ];

    const reports = [
      {
        key: '0xrep1',
        blockNumber: 115n,
        txHash: '0xtx1',
        creator: '0xdoctor1',
        payload: {
          type: 'ground_report' as const,
          record_id: 'IND-AP-2026-04',
          severity: 9,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Cartons soaked in water, broken seals',
          photo_cids: ['bafytest1'],
          reporter_role: 'DOCTOR' as const,
        },
      },
      {
        key: '0xrep2',
        blockNumber: 118n,
        txHash: '0xtx2',
        creator: '0xinspector1',
        payload: {
          type: 'ground_report' as const,
          record_id: 'IND-AP-2026-04',
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 280,
          description: 'Medicine vials damaged during transit',
          photo_cids: ['bafytest2'],
          reporter_role: 'INSPECTOR' as const,
        },
      },
      {
        key: '0xrep3',
        blockNumber: 120n,
        txHash: '0xtx3',
        creator: '0xcitizen1',
        payload: {
          type: 'ground_report' as const,
          record_id: 'IND-AP-2026-04',
          severity: 8,
          verdict: 'DAMAGED' as const,
          count_received: 300,
          description: 'Stock received is unusable',
          photo_cids: ['bafytest3'],
          reporter_role: 'CITIZEN' as const,
        },
      },
    ];

    const input: DetectionInput = {
      currentRecord,
      revisions,
      reports,
      defaultThresholdK: 3,
    };

    const result = detectCoverUp(input);

    expect(result.isCoverUp).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.evidences.length).toBeGreaterThan(0);

    const primaryEvidence = result.evidences[0];
    expect(primaryEvidence.suspiciousEditBlock).toBe(125n);
    expect(primaryEvidence.custodianWallet).toBe('0x8a99999999999999999999999999999999999999');
    expect(primaryEvidence.oldStatus).toBe('DAMAGED');
    expect(primaryEvidence.newStatus).toBe('ALL_GOOD_DELIVERED');
    expect(primaryEvidence.contradictingReports.length).toBe(3);

    expect(result.alertMessage).toBeDefined();
    expect(result.alertMessage).toContain('ALERT: At block #125');
    expect(result.alertMessage).toContain('ALL_GOOD_DELIVERED');
    expect(result.alertMessage).toContain('3 immutable citizen reports say DAMAGED');
  });

  it('does NOT flag a clean record with genuine delivery and positive reports', () => {
    const currentRecord: CivicRecordPayload = {
      type: 'civic_record',
      record_id: 'IND-CLEAN-2026-01',
      kind: 'RELIEF_KIT',
      title: '200 Flood Relief Kits',
      quantity_dispatched: 200,
      quantity_received: 200,
      status: 'DELIVERED',
      origin: 'District Warehouse',
      destination: 'Camp Alpha',
      district: 'Krishna',
      ward_id: 'W-01',
      notes: 'Delivered in full',
    };

    const revisions: RecordRevision[] = [
      {
        blockNumber: 200n,
        txHash: '0xclean1',
        updater: '0x1111111111111111111111111111111111111111',
        type: 'CREATED',
        status: 'CREATED',
      },
      {
        blockNumber: 210n,
        txHash: '0xclean2',
        updater: '0x2222222222222222222222222222222222222222',
        type: 'PATCHED',
        status: 'IN_TRANSIT',
      },
      {
        blockNumber: 220n,
        txHash: '0xclean3',
        updater: '0x3333333333333333333333333333333333333333',
        type: 'PATCHED',
        status: 'DELIVERED',
      },
    ];

    const reports = [
      {
        key: '0xclean_rep1',
        blockNumber: 225n,
        txHash: '0xtx_clean1',
        creator: '0xcitizen_clean',
        payload: {
          type: 'ground_report' as const,
          record_id: 'IND-CLEAN-2026-01',
          severity: 1,
          verdict: 'ALL_GOOD' as const,
          count_received: 200,
          description: 'All 200 kits intact and distributed',
          photo_cids: [],
          reporter_role: 'CITIZEN' as const,
        },
      },
    ];

    const result = detectCoverUp({
      currentRecord,
      revisions,
      reports,
    });

    expect(result.isCoverUp).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.evidences.length).toBe(0);
    expect(result.alertMessage).toBeUndefined();
  });
});
