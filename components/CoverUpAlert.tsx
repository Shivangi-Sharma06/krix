'use client';

import React from 'react';
import type { CoverUpDetectionResult } from '@/lib/types';
import { EXPLORER_URL } from '@/lib/arkiv';
import { getIpfsGatewayUrl } from '@/lib/ipfs';

interface CoverUpAlertProps {
  detection: CoverUpDetectionResult | null;
  onDetectClick: () => void;
  loading: boolean;
}

export function CoverUpAlert({ detection, onDetectClick, loading }: CoverUpAlertProps) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={onDetectClick}
          disabled={loading}
          className="btn btn-danger btn-md"
          style={{ height: '38px', padding: '0 16px', fontWeight: 600 }}
        >
          {loading ? 'Auditing On-Chain Revisions...' : 'Detect Cover-Up'}
        </button>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Runs automated cross-examination of official status changes against immutable ground reports.
        </span>
      </div>

      {detection && (
        <div
          role="region"
          aria-label="Cover-up detection results"
          style={{
            border: `1px solid ${detection.isCoverUp ? 'var(--danger-border)' : 'var(--success-border)'}`,
            backgroundColor: detection.isCoverUp ? 'var(--danger-bg)' : 'var(--success-bg)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
          }}
        >
          {/* Header & Score */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '16px',
              borderBottom: `1px solid ${detection.isCoverUp ? 'var(--danger-border)' : 'var(--success-border)'}`,
              paddingBottom: '18px',
              marginBottom: '18px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: detection.isCoverUp ? 'var(--danger)' : 'var(--success)',
                  marginBottom: '6px',
                  letterSpacing: '0.02em',
                }}
              >
                {detection.isCoverUp ? 'CONTRADICTION DETECTED' : 'NO CONTRADICTION FOUND'}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, maxWidth: '640px' }}>
                {detection.isCoverUp
                  ? detection.alertMessage
                  : 'All official custodian edits are consistent with reported ground reality submissions.'}
              </div>
            </div>

            {/* Score Box */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface-raised)',
                borderRadius: 'var(--radius-card)',
                padding: '12px 20px',
                textAlign: 'center',
                minWidth: '130px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Discrepancy Score
              </div>
              <div
                className="mono"
                style={{
                  fontSize: '26px',
                  fontWeight: 600,
                  color: detection.score >= 50 ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {detection.score} / 100
              </div>
            </div>
          </div>

          {/* Formula Breakdown */}
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: '20px',
              backgroundColor: 'var(--bg-surface-raised)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-btn)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div><strong>Detection Formula:</strong> {detection.scoreBreakdown.formula}</div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '14px', flexWrap: 'wrap', color: 'var(--text-main)' }}>
              <span>Independent Reporters: <strong>+{detection.scoreBreakdown.independentReportersWeight}</strong></span>
              <span>Avg Severity: <strong>+{detection.scoreBreakdown.averageSeverityWeight}</strong></span>
              <span>Status Reversals: <strong>+{detection.scoreBreakdown.statusReversalWeight}</strong></span>
              <span>Reverse Timing: <strong>+{detection.scoreBreakdown.reverseTimingWeight}</strong></span>
              <span>Quantity Gap: <strong>+{detection.scoreBreakdown.quantityGapWeight}</strong></span>
              {detection.scoreBreakdown.tamperingWeight > 0 && (
                <span>Tampering: <strong>+{detection.scoreBreakdown.tamperingWeight}</strong></span>
              )}
            </div>
          </div>

          {/* Documented Evidence List */}
          {detection.evidences.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.08em' }}>
                On-Chain Evidence Items ({detection.evidences.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {detection.evidences.map((evidence, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-card)',
                      padding: '16px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {evidence.ruleId}: {evidence.description}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>
                      Suspicious Edit Block: <strong style={{ color: 'var(--text-main)' }}>#{evidence.suspiciousEditBlock.toString()}</strong> &middot; Custodian:{' '}
                      <span className="mono">{evidence.custodianWallet}</span> &middot; Tx:{' '}
                      <a
                        href={`${EXPLORER_URL}/tx/${evidence.suspiciousEditTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono"
                        style={{ color: 'var(--accent)' }}
                      >
                        {evidence.suspiciousEditTxHash.slice(0, 16)}...
                      </a>
                    </div>

                    {evidence.contradictingReports.length > 0 && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                          Contradicting Immutable Reports on Record:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-muted)' }}>
                          {evidence.contradictingReports.map((cr, cIdx) => (
                            <li key={cIdx} style={{ marginBottom: '8px' }}>
                              <span>
                                Block #{cr.blockNumber.toString()} by{' '}
                                <span className="mono">{cr.reporter.slice(0, 8)}...</span>: Verdict:{' '}
                                <strong style={{ color: 'var(--danger)' }}>{cr.verdict}</strong> (Severity: {cr.severity}/10) &mdash; &ldquo;{cr.description}&rdquo;
                              </span>
                              {cr.photo_cids.length > 0 && (
                                <div style={{ marginTop: '6px', display: 'flex', gap: '10px' }}>
                                  {cr.photo_cids.map((cid, pIdx) => (
                                    <a
                                      key={pIdx}
                                      href={getIpfsGatewayUrl(cid)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: '12px', color: 'var(--accent)' }}
                                    >
                                      [View Photo ({cid.slice(0, 10)}...)]
                                    </a>
                                  ))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
