'use client';

import React, { useEffect, useState } from 'react';

export function HeroProductMock() {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFlipped((prev) => !prev);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: '24px',
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        transition: 'border-color 0.4s ease',
        borderColor: isFlipped ? 'var(--danger-border)' : 'var(--border-subtle)',
      }}
    >
      {/* Mock Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
            KX-MEDICINE-GNT-2026-04
          </span>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
            500 Dengue Testing Kits
          </div>
        </div>

        {/* Flipping Status Badge */}
        <span
          className={`badge ${isFlipped ? 'badge-success' : 'badge-danger'}`}
          style={{
            transition: 'background-color 0.4s ease, color 0.4s ease',
            fontSize: '11px',
          }}
        >
          {isFlipped ? 'ALL GOOD DELIVERED' : 'DAMAGED'}
        </span>
      </div>

      {/* Custody summary */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-raised)',
          borderRadius: 'var(--radius-btn)',
          padding: '10px 14px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <span>Custodian: <span className="mono">0x3C4D...23C4 (Clinic)</span></span>
        <span>Dispatched: <strong style={{ color: 'var(--text-main)' }}>500</strong> | Recv: <strong style={{ color: 'var(--text-main)' }}>{isFlipped ? '500' : '300'}</strong></span>
      </div>

      {/* 3 Permanent Report Chips */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>
          3 &times; Immutable Ground Reports (readonly: true)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-main)' }}>Doctor (PHC Mangalagiri): &ldquo;Vials soaked in water, broken seals&rdquo;</span>
            <span className="badge badge-danger" style={{ fontSize: '10px' }}>Sev 9/10</span>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-main)' }}>Inspector (Quality Div): &ldquo;200 units compromised during transit&rdquo;</span>
            <span className="badge badge-danger" style={{ fontSize: '10px' }}>Sev 8/10</span>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-main)' }}>Ward Citizen: &ldquo;Patients turned away due to defective stock&rdquo;</span>
            <span className="badge badge-danger" style={{ fontSize: '10px' }}>Sev 8/10</span>
          </div>
        </div>
      </div>

      {/* Red Contradiction Found Strip */}
      <div
        style={{
          backgroundColor: isFlipped ? 'var(--danger-bg)' : 'var(--bg-surface-raised)',
          border: '1px solid',
          borderColor: isFlipped ? 'var(--danger-border)' : 'var(--border-subtle)',
          borderRadius: 'var(--radius-btn)',
          padding: '8px 12px',
          fontSize: '12px',
          color: isFlipped ? 'var(--danger)' : 'var(--text-faint)',
          transition: 'all 0.4s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {isFlipped
            ? 'CONTRADICTION DETECTED: Status flipped to ALL_GOOD after 3 negative reports'
            : 'Auditing on-chain block revisions...'}
        </span>
        <span className="mono" style={{ fontSize: '11px', color: isFlipped ? 'var(--danger)' : 'var(--text-faint)' }}>
          {isFlipped ? 'Block #410290' : 'Block #410180'}
        </span>
      </div>
    </div>
  );
}
