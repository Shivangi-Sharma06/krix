'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchCivicRecords, fetchCivicRecordByKey, fetchGroundReports, type EntityWithMetadata } from '@/lib/arkiv';
import type { CivicRecordPayload, GroundReportPayload } from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';

export function LandingInteractiveDemo() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordKey, setRecordKey] = useState<string | null>(null);
  const [record, setRecord] = useState<CivicRecordPayload | null>(null);
  const [reports, setReports] = useState<GroundReportPayload[]>([]);
  const [currentBlock, setCurrentBlock] = useState<number>(410290);
  const [historicalState, setHistoricalState] = useState<{
    status: string;
    quantityReceived: number;
    notes: string;
  }>({
    status: 'ALL_GOOD_DELIVERED',
    quantityReceived: 500,
    notes: 'Audit passed: all 500 kits accounted for and in pristine condition.',
  });

  useEffect(() => {
    async function loadDemoRecord() {
      try {
        setLoading(true);
        setError(null);
        const records = await fetchCivicRecords();
        // Look for demo record or first record
        const demo = records.find(
          (r) =>
            r.payload.reference_code?.includes('DEMO') ||
            r.payload.reference_code?.includes('MED') ||
            r.payload.title?.includes('Dengue')
        ) || records[0];

        if (demo) {
          setRecordKey(demo.key);
          setRecord(demo.payload);
          const reps = await fetchGroundReports(demo.key);
          setReports(reps.map((rp) => rp.payload));
        } else {
          // No records on chain yet
          setRecord({
            type: 'civic_record',
            reference_code: 'KX-MEDICINE-GNT-2026-DEMO01',
            kind: 'MEDICINE_BATCH',
            title: '500 Dengue Testing Kits',
            quantity_dispatched: 500,
            quantity_received: 500,
            status: 'ALL_GOOD_DELIVERED',
            origin: 'State Warehouse, Vijayawada',
            destination: 'PHC Mangalagiri',
            district: 'Guntur',
            ward_id: 'W-12',
            notes: 'Audit passed: all 500 kits accounted for and in pristine condition.',
          });
        }
      } catch (err: any) {
        console.warn('Landing demo chain fetch issue:', err);
        setError('Live chain data is currently unreachable. Check network status.');
      } finally {
        setLoading(false);
      }
    }

    loadDemoRecord();
  }, []);

  const handleSliderChange = (block: number) => {
    setCurrentBlock(block);
    if (block <= 410180) {
      setHistoricalState({
        status: 'DAMAGED',
        quantityReceived: 300,
        notes: 'Boxes wet from rain, broken seals on 200 kits.',
      });
    } else if (block <= 410240) {
      setHistoricalState({
        status: 'DAMAGED',
        quantityReceived: 300,
        notes: 'Clinical staff reported defective vials and temperature breach.',
      });
    } else {
      setHistoricalState({
        status: 'ALL_GOOD_DELIVERED',
        quantityReceived: 500,
        notes: 'Audit passed: all 500 kits accounted for and in pristine condition.',
      });
    }
  };

  const isCoverUpExposed = currentBlock > 410240;

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isCoverUpExposed ? 'var(--danger-border)' : 'var(--border-subtle)',
        padding: '32px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', fontWeight: 600, marginBottom: '6px' }}>
            Interactive Demo &middot; Scrub History
          </div>
          <h3 className="card-title" style={{ fontSize: '22px', margin: 0 }}>
            {record?.title || '500 Dengue Testing Kits'}
          </h3>
          <div className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {record?.reference_code || 'KX-MEDICINE-GNT-2026-DEMO01'}
          </div>
        </div>

        {error ? (
          <span className="badge badge-warning">Live data unavailable</span>
        ) : (
          <span className="badge badge-default mono">Tiramisu Testnet Verified</span>
        )}
      </div>

      {/* Scrubber Control */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Historical Block Height:</span>
          <span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
            Block #{currentBlock}
          </span>
        </div>

        <input
          type="range"
          min={410180}
          max={410290}
          step={10}
          value={currentBlock}
          onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
          style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
          aria-label="Time travel block scrubber"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-faint)', marginTop: '6px' }}>
          <span>#410180 (Clinic records Damaged)</span>
          <span>#410230 (Doctor reports)</span>
          <span>#410290 (Cover-up edit)</span>
        </div>
      </div>

      {/* Red/Green Diff Comparison */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ backgroundColor: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-card)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Recorded At Block #{currentBlock}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              className={`badge ${
                historicalState.status === 'DAMAGED'
                  ? 'badge-danger'
                  : 'badge-success'
              }`}
            >
              {historicalState.status}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Received: <strong>{historicalState.quantityReceived} / 500</strong>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            &ldquo;{historicalState.notes}&rdquo;
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-card)', padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Permanent Ground Reality (3 Reports)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-danger">3 &times; DAMAGED (Avg 8.3/10)</span>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Doctor, Health Inspector, and Citizen verified broken seals and rain damage.
          </p>
        </div>
      </div>

      {/* Contradiction Strip */}
      {isCoverUpExposed ? (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-btn)',
            padding: '12px 16px',
            color: 'var(--danger)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong>CONTRADICTION DETECTED:</strong> Status was altered to ALL_GOOD_DELIVERED despite 3 independent DAMAGED reports on-chain.
          </div>
          {recordKey && (
            <Link
              href={`/records/${recordKey}`}
              className="btn btn-secondary btn-md"
              style={{ fontSize: '12px', height: '28px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
            >
              Inspect Proof &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-btn)',
            padding: '12px 16px',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          At block #{currentBlock}, recorded status matches ground reality: DAMAGED. Scrub right to see the cover-up edit.
        </div>
      )}
    </div>
  );
}
