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
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '16px',
          color: 'var(--text-muted)',
          fontSize: '14px',
          marginBottom: '24px',
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
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
            Catch the Cover-Up: Time-Travel Engine
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Scrub block height to query on-chain historical snapshots directly via Arkiv <code>atBlock</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrev}
            disabled={currentIdx === 0}
            className="btn-secondary"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
          >
            ← Previous Revision
          </button>
          <button
            onClick={handleNext}
            disabled={currentIdx === sortedBlocks.length - 1}
            className="btn-secondary"
            style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
          >
            Next Revision →
          </button>
          {isTimeTraveling && (
            <button
              onClick={() => onBlockChange(null)}
              className="btn-secondary"
              style={{ height: '32px', padding: '0 10px', fontSize: '12px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            >
              Reset to Head
            </button>
          )}
        </div>
      </div>

      {/* Slider Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
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
          style={{ flex: 1, cursor: 'pointer', height: '6px' }}
        />
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          #{maxBlock.toString()}
        </span>
      </div>

      <div style={{ fontSize: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          Viewing Block:{' '}
          <span style={{ fontFamily: 'monospace', fontWeight: '700', color: isTimeTraveling ? 'var(--danger)' : 'var(--text-main)' }}>
            #{activeBlock.toString()}
          </span>{' '}
          {isTimeTraveling ? (
            <span className="badge badge-red" style={{ marginLeft: '8px' }}>HISTORICAL SNAPSHOT</span>
          ) : (
            <span className="badge badge-green" style={{ marginLeft: '8px' }}>LATEST ON-CHAIN HEAD</span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Revision {currentIdx + 1} of {sortedBlocks.length}
        </div>
      </div>

      {/* Two Columns Diff View: At This Block vs Now */}
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '25%', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                Field
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '37.5%', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                At Block #{activeBlock.toString()} (Scrubbed)
              </th>
              <th style={{ padding: '10px 14px', textAlign: 'left', width: '37.5%', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                Now (Head Block #{maxBlock.toString()})
              </th>
            </tr>
          </thead>
          <tbody>
            {diffFields.map((field, i) => {
              const changed = field.oldVal !== field.newVal;
              return (
                <tr key={i} style={{ borderBottom: i < diffFields.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontWeight: '600' }}>{field.label}</td>
                  <td
                    style={{
                      padding: '10px 14px',
                      backgroundColor: changed ? 'var(--danger-light)' : 'transparent',
                      color: changed ? 'var(--danger)' : 'inherit',
                      fontWeight: changed ? '600' : 'normal',
                    }}
                  >
                    {field.oldVal}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      backgroundColor: changed ? 'var(--success-light)' : 'transparent',
                      color: changed ? 'var(--success)' : 'inherit',
                      fontWeight: changed ? '600' : 'normal',
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
