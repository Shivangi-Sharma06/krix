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
      <div style={{ border: '1px solid #ccc', padding: '12px', background: '#fafafa', fontSize: '13px' }}>
        <strong>Time-Travel Engine:</strong> Only one block revision recorded so far. Revisions will appear here as status updates and handovers occur.
      </div>
    );
  }

  const sortedBlocks = [...historicalBlocks].sort((a, b) => (a < b ? -1 : 1));
  const minBlock = sortedBlocks[0];
  const maxBlock = sortedBlocks[sortedBlocks.length - 1];

  const activeBlock = selectedBlock !== null ? selectedBlock : maxBlock;
  const isTimeTraveling = selectedBlock !== null && selectedBlock < maxBlock;

  // Comparison fields between head and selected block
  const past = recordAtSelectedBlock || currentRecord;
  const head = currentRecord;

  const diffFields = [
    { label: 'Status', oldVal: past.status, newVal: head.status },
    { label: 'Quantity Received', oldVal: past.quantity_received, newVal: head.quantity_received },
    { label: 'Notes', oldVal: past.notes, newVal: head.notes },
  ];

  return (
    <div style={{ border: '1px solid #ccc', padding: '16px', background: '#fff', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Catch the Cover-Up: Time-Travel Engine</h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>
            Scrub block height to query on-chain historical state via Arkiv <code>atBlock</code>.
          </p>
        </div>
        {isTimeTraveling && (
          <button
            onClick={() => onBlockChange(null)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px solid #999',
              background: '#eee',
              cursor: 'pointer',
            }}
          >
            Reset to Latest Head
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>#{minBlock.toString()}</span>
        <input
          type="range"
          min={0}
          max={sortedBlocks.length - 1}
          value={sortedBlocks.indexOf(activeBlock) !== -1 ? sortedBlocks.indexOf(activeBlock) : sortedBlocks.length - 1}
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            onBlockChange(sortedBlocks[idx]);
          }}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>#{maxBlock.toString()}</span>
      </div>

      <div style={{ fontSize: '13px', marginBottom: '14px' }}>
        Viewing State At Block:{' '}
        <strong style={{ fontFamily: 'monospace', color: isTimeTraveling ? '#d32f2f' : '#000' }}>
          #{activeBlock.toString()} {isTimeTraveling ? '(HISTORICAL SNAPSHOT)' : '(LATEST HEAD)'}
        </strong>
      </div>

      {/* Red / Green Diff View */}
      {isTimeTraveling && (
        <div style={{ border: '1px solid #ccc', padding: '12px', background: '#fcfcfc' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            REVISION DIFF: Block #{activeBlock.toString()} vs. Latest Block #{maxBlock.toString()}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#eee', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '6px', textAlign: 'left', width: '25%' }}>Property</th>
                <th style={{ padding: '6px', textAlign: 'left', width: '37%' }}>
                  State at #{activeBlock.toString()} (Past)
                </th>
                <th style={{ padding: '6px', textAlign: 'left', width: '37%' }}>
                  State at #{maxBlock.toString()} (Head)
                </th>
              </tr>
            </thead>
            <tbody>
              {diffFields.map((field, i) => {
                const changed = field.oldVal !== field.newVal;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px', fontWeight: 'bold' }}>{field.label}</td>
                    <td
                      style={{
                        padding: '6px',
                        background: changed ? '#ffebee' : 'transparent',
                        color: changed ? '#b71c1c' : '#000',
                      }}
                    >
                      {String(field.oldVal || '-')}
                    </td>
                    <td
                      style={{
                        padding: '6px',
                        background: changed ? '#e8f5e9' : 'transparent',
                        color: changed ? '#2e7d32' : '#000',
                      }}
                    >
                      {String(field.newVal || '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
