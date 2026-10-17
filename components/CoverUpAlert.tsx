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
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
        <button
          onClick={onDetectClick}
          disabled={loading}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 'bold',
            background: '#b71c1c',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Auditing On-Chain Revisions...' : '🔍 Detect Cover-Up'}
        </button>
        <span style={{ fontSize: '12px', color: '#666' }}>
          Cross-examines official revisions against immutable citizen reports using PRD detection rules.
        </span>
      </div>

      {detection && (
        <div
          style={{
            border: detection.isCoverUp ? '2px solid #b71c1c' : '2px solid #2e7d32',
            background: detection.isCoverUp ? '#fff5f5' : '#f1f8e9',
            padding: '16px',
          }}
        >
          {/* Header & Score */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid #ccc',
              paddingBottom: '12px',
              marginBottom: '12px',
            }}
          >
            <div>
              <h3
                style={{
                  margin: '0 0 4px 0',
                  color: detection.isCoverUp ? '#b71c1c' : '#2e7d32',
                  fontSize: '18px',
                }}
              >
                {detection.isCoverUp ? '🚨 COVER-UP DETECTED' : '✅ NO COVER-UP DETECTED'}
              </h3>
              <div style={{ fontSize: '13px' }}>
                {detection.isCoverUp
                  ? detection.alertMessage
                  : 'Official record history is consistent with reported ground realities.'}
              </div>
            </div>

            {/* Score Box */}
            <div
              style={{
                border: '1px solid #999',
                background: '#fff',
                padding: '8px 12px',
                textAlign: 'center',
                minWidth: '120px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#666' }}>COVER-UP SCORE</div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: detection.score >= 50 ? '#b71c1c' : '#2e7d32',
                }}
              >
                {detection.score} / 100
              </div>
            </div>
          </div>

          {/* Transparent Formula Breakdown (FR-C7) */}
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '14px', background: '#fff', padding: '8px', border: '1px solid #eee' }}>
            <strong>Transparent Formula Breakdown:</strong> {detection.scoreBreakdown.formula}
            <div style={{ marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span>Contradicting Reports: <strong>+{detection.scoreBreakdown.contradictingReportsWeight}</strong></span>
              <span>Avg Severity: <strong>+{detection.scoreBreakdown.averageSeverityWeight}</strong></span>
              <span>Status Reversals: <strong>+{detection.scoreBreakdown.statusReversalWeight}</strong></span>
              <span>Reverse Timing: <strong>+{detection.scoreBreakdown.reverseTimingWeight}</strong></span>
              <span>Quantity Gap: <strong>+{detection.scoreBreakdown.quantityGapWeight}</strong></span>
            </div>
          </div>

          {/* Evidences List */}
          {detection.evidences.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#b71c1c' }}>
                DOCUMENTED ON-CHAIN EVIDENCE:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {detection.evidences.map((evidence, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #e0b4b4',
                      background: '#fff',
                      padding: '10px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {evidence.ruleId}: {evidence.description}
                    </div>
                    <div style={{ color: '#444', marginBottom: '6px' }}>
                      Edit Block: <strong>#{evidence.suspiciousEditBlock.toString()}</strong> | Custodian:{' '}
                      <span style={{ fontFamily: 'monospace' }}>{evidence.custodianWallet}</span> | Tx:{' '}
                      <a
                        href={`${EXPLORER_URL}/tx/${evidence.suspiciousEditTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0066cc', fontFamily: 'monospace' }}
                      >
                        {evidence.suspiciousEditTxHash.slice(0, 16)}...
                      </a>
                    </div>

                    {evidence.contradictingReports.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>Contradicting Immutable Reports:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {evidence.contradictingReports.map((cr, cIdx) => (
                            <li key={cIdx} style={{ marginBottom: '6px' }}>
                              <span>
                                Block #{cr.blockNumber.toString()} by{' '}
                                <span style={{ fontFamily: 'monospace' }}>{cr.reporter.slice(0, 8)}...</span>: Verdict:{' '}
                                <strong>{cr.verdict}</strong> (Severity {cr.severity}/10) - "{cr.description}"
                              </span>
                              {cr.photo_cids.length > 0 && (
                                <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                                  {cr.photo_cids.map((cid, pIdx) => (
                                    <a
                                      key={pIdx}
                                      href={getIpfsGatewayUrl(cid)}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'inline-block',
                                        fontSize: '11px',
                                        color: '#0066cc',
                                        textDecoration: 'underline',
                                      }}
                                    >
                                      [View Photo Evidence ({cid.slice(0, 10)}...)]
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
