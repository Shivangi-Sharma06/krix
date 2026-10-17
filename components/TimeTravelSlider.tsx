'use client';

import React from 'react';
import type { CivicRecordPayload } from '@/lib/types';

interface TimeTravelSliderProps {
  currentRecord: CivicRecordPayload;
  historicalBlocks: bigint[];
  selectedBlock: bigint | null;
  onBlockChange: (block: bigint | null) => void;
  recordAtSelectedBlock: CivicRecordPayload | null;
}

export function TimeTravelSlider({
  currentRecord,
  historicalBlocks,
  selectedBlock,
  onBlockChange,
  recordAtSelectedBlock,
}: TimeTravelSliderProps) {
  if (historicalBlocks.length === 0) {
    return (
      <div
        className="card"
        style={{
          color: 'var(--text-muted)',
          fontSize: '14px',
          marginBottom: '28px',
        }}
      >
        <strong>Time-Travel Engine:</strong> One block revision recorded so far. Scrubbing enables as more on-chain transactions land.
      </div>
    );
  }

  const sortedBlocks = [...historicalBlocks].sort((a, b) => (a < b ? -1 : 1));
  const minBlock = sortedBlocks[0];
  const maxBlock = sortedBlocks[sortedBlocks.length - 1];

  const activeBlock = selectedBlock !== null ? selectedBlock : maxBlock;
  const isTimeTraveling = selectedBlock !== null && selectedBlock < maxBlock;

  const past = recordAtSelectedBlock || currentRecord;
  const head = currentRecord;

  const currentIdx = sortedBlocks.indexOf(activeBlock) !== -1 ? sortedBlocks.indexOf(activeBlock) : sortedBlocks.length - 1;

  const diffFields = [
    { label: 'Official Status', oldVal: past.status, newVal: head.status },
    { label: 'Claimed Received', oldVal: `${past.quantity_received || 0} units`, newVal: `${head.quantity_received || 0} units` },
    { label: 'Custodian Notes', oldVal: past.notes || '(None)', newVal: head.notes || '(None)' },
  ];

  const handlePrev = () => {
    if (currentIdx > 0) onBlockChange(sortedBlocks[currentIdx - 1]);
  };

  const handleNext = () => {
    if (currentIdx < sortedBlocks.length - 1) onBlockChange(sortedBlocks[currentIdx + 1]);
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: '28px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div className="eyebrow">On-Chain Historical Verification</div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
            Catch the Cover-Up: Time-Travel Engine
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
            Scrub block height to query past on-chain snapshots directly via Arkiv <code>atBlock</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="btn btn-secondary btn-md"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
          >
            &larr; Prev
          </button>
          <button
            onClick={handleNext}
            disabled={currentIdx === sortedBlocks.length - 1}
            className="btn btn-secondary btn-md"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
          >
            Next &rarr;
          </button>
          {isTimeTraveling && (
            <button
              onClick={() => onBlockChange(null)}
              className="btn btn-secondary btn-md"
              style={{ height: '32px', padding: '0 10px', fontSize: '12px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              Reset to Head
            </button>
          )}
        </div>
      </div>

      {/* Slider Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          #{minBlock.toString()}
        </span>
        <input
          type="range"
          min={0}
          max={sortedBlocks.length - 1}
          value={currentIdx}
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            onBlockChange(sortedBlocks[idx]);
          }}
          aria-label="Block revision scrubber"
          style={{ flex: 1, cursor: 'pointer', height: '6px', accentColor: 'var(--accent)' }}
        />
        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          #{maxBlock.toString()}
        </span>
      </div>

      <div style={{ fontSize: '14px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Viewing Block:</span>{' '}
          <span className="mono" style={{ fontWeight: 600, color: isTimeTraveling ? 'var(--danger)' : 'var(--accent)' }}>
            #{activeBlock.toString()}
          </span>{' '}
          {isTimeTraveling ? (
            <span className="badge badge-danger" style={{ marginLeft: '8px' }}>HISTORICAL SNAPSHOT</span>
          ) : (
            <span className="badge badge-success" style={{ marginLeft: '8px' }}>LATEST ON-CHAIN HEAD</span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
          Revision {currentIdx + 1} of {sortedBlocks.length}
        </div>
      </div>

      {/* Two Columns Diff View: At This Block vs Now */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: '25%', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Field
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: '37.5%', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                At Block #{activeBlock.toString()} (Scrubbed)
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', width: '37.5%', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Now (Head Block #{maxBlock.toString()})
              </th>
            </tr>
          </thead>
          <tbody>
            {diffFields.map((field, i) => {
              const changed = field.oldVal !== field.newVal;
              return (
                <tr key={i} style={{ borderBottom: i < diffFields.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>{field.label}</td>
                  <td
                    style={{
                      padding: '12px 16px',
                      backgroundColor: changed ? 'var(--danger-bg)' : 'transparent',
                      color: changed ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: changed ? 600 : 'normal',
                    }}
                  >
                    {field.oldVal}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      backgroundColor: changed ? 'var(--success-bg)' : 'transparent',
                      color: changed ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: changed ? 600 : 'normal',
                    }}
                  >
                    {field.newVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
