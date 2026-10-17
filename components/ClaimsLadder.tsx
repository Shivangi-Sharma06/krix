'use client';

import React from 'react';
import type { ClaimsLadderResult, LadderClaimEntry, LadderFinding } from '@/lib/types';
import { EXPLORER_URL } from '@/lib/arkiv';
import { getIpfsGatewayUrls } from '@/lib/ipfs';
import { AlertCircle, AlertTriangle, Info, Clock, CheckCircle, ShieldCheck, MapPin, Camera } from 'lucide-react';

interface ClaimsLadderProps {
  ladder: ClaimsLadderResult;
  loading?: boolean;
}

export function ClaimsLadder({ ladder, loading }: ClaimsLadderProps) {
  const { claims, findings, uniqueIndependentWallets, totalStatements, totalCitizenReports, disclaimer } = ladder;

  return (
    <div
      className="card"
      style={{
        padding: '24px',
        marginBottom: '28px',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* Title & Stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              className="badge"
              style={{
                backgroundColor: 'var(--bg-surface-raised)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Read-Only Claims Ledger
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              Ordered chronologically by block number
            </span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', margin: '4px 0 6px 0' }}>
            Claims Ladder
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, maxWidth: '640px' }}>
            Side-by-side on-chain record comparing official commitments, intermediary statements, and citizen ground reports.
          </p>
        </div>

        {/* Counts summary (Counts unique wallets, not raw entries) */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-btn)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Independent Wallets
            </div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
              {uniqueIndependentWallets}
            </div>
          </div>

          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-btn)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Statements
            </div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>
              {totalStatements}
            </div>
          </div>

          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-btn)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
              Citizen Reports
            </div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--success)' }}>
              {totalCitizenReports}
            </div>
          </div>
        </div>
      </div>

      {/* Ladder Findings / Flags (Neutral non-accusatory wording) */}
      {findings.length > 0 && (
        <div style={{ marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {findings.map((f, idx) => {
            const isAlert = f.severity === 'ALERT';
            return (
              <div
                key={idx}
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-card)',
                  backgroundColor: isAlert ? 'var(--danger-bg)' : 'rgba(234, 179, 8, 0.08)',
                  border: `1px solid ${isAlert ? 'var(--danger-border)' : 'rgba(234, 179, 8, 0.25)'}`,
                }}
              >
                <div style={{ color: isAlert ? 'var(--danger)' : '#eab308', marginTop: '2px', flexShrink: 0 }}>
                  {isAlert ? <AlertCircle size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isAlert ? 'var(--danger)' : '#eab308', marginBottom: '2px' }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {f.description}
                  </div>
                  {f.blockTimes && (
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '4px' }}>
                      Earlier Block #{f.blockTimes.earlierBlock.toString()} &rarr; Later Block #{f.blockTimes.laterBlock.toString()}
                      {f.difference !== undefined && ` &bull; Unexplained Difference: ${f.difference} units`}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Claims Ladder Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px 0' }}>
          <div className="skeleton" style={{ height: '50px' }} />
          <div className="skeleton" style={{ height: '50px' }} />
          <div className="skeleton" style={{ height: '50px' }} />
        </div>
      ) : claims.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          No claims recorded yet for this promise.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Block / Time
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Voice / Source
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Party Type (Self-Declared)
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Location
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Counts
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Condition / Status
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Statement &amp; Photos
                </th>
                <th style={{ padding: '12px 14px', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Signer Wallet
                </th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, idx) => {
                const isAuth = claim.source === 'AUTHORITY' || claim.source === 'AUTHORITY_RESPONSE';
                const isStmt = claim.source === 'STATEMENT';
                const isCit = claim.source === 'CITIZEN_REPORT';

                return (
                  <tr
                    key={claim.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isAuth ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                    }}
                  >
                    {/* Block */}
                    <td className="mono" style={{ padding: '12px 14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        #{claim.blockNumber.toString()}
                      </div>
                      {claim.txHash && claim.txHash !== '0xgenesis' && (
                        <a
                          href={`${EXPLORER_URL}/tx/${claim.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}
                        >
                          tx &rarr;
                        </a>
                      )}
                    </td>

                    {/* Source */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isAuth
                            ? 'var(--accent-soft)'
                            : isStmt
                            ? 'var(--bg-surface-raised)'
                            : 'rgba(34, 197, 94, 0.1)',
                          color: isAuth
                            ? 'var(--accent)'
                            : isStmt
                            ? 'var(--text-main)'
                            : 'var(--success)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {claim.source.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Party Type (Self-declared) */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                        {claim.partyType || '—'}
                      </div>
                      {!isAuth && (
                        <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                          (self-declared)
                        </div>
                      )}
                    </td>

                    {/* Location */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                        <MapPin size={13} style={{ flexShrink: 0 }} />
                        <span>{claim.location || '—'}</span>
                      </div>
                    </td>

                    {/* Counts */}
                    <td className="mono" style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      {claim.claimedQuantity !== undefined && (
                        <div>Dispatched: <strong>{claim.claimedQuantity}</strong></div>
                      )}
                      {claim.receivedCount !== undefined && (
                        <div>Received: <strong style={{ color: 'var(--text-main)' }}>{claim.receivedCount}</strong></div>
                      )}
                      {claim.passedOnCount !== undefined && (
                        <div style={{ color: 'var(--text-muted)' }}>Passed on: {claim.passedOnCount}</div>
                      )}
                      {claim.claimedQuantity === undefined && claim.receivedCount === undefined && claim.passedOnCount === undefined && (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>

                    {/* Condition / Status */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      {claim.statusClaim && (
                        <span className="badge badge-info" style={{ fontSize: '11px' }}>
                          Status: {claim.statusClaim}
                        </span>
                      )}
                      {claim.condition && (
                        <span
                          className={`badge ${
                            claim.condition === 'OK' || claim.condition === 'ALL_GOOD'
                              ? 'badge-success'
                              : 'badge-danger'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          {claim.condition}
                        </span>
                      )}
                    </td>

                    {/* Notes & Photos */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', maxWidth: '280px' }}>
                      {claim.notes ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4, marginBottom: '6px' }}>
                          {claim.notes}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}

                      {claim.photoCids && claim.photoCids.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {claim.photoCids.map((cid, cIdx) => {
                            const urls = getIpfsGatewayUrls(cid);
                            return (
                              <a
                                key={cIdx}
                                href={urls[0]}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: 'var(--accent)',
                                  textDecoration: 'none',
                                  backgroundColor: 'var(--bg-surface-raised)',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <Camera size={11} /> Photo #{cIdx + 1}
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Signer Wallet */}
                    <td className="mono" style={{ padding: '12px 14px', verticalAlign: 'top', fontSize: '12px' }}>
                      <div style={{ color: 'var(--text-main)' }}>
                        {claim.wallet ? `${claim.wallet.slice(0, 6)}...${claim.wallet.slice(-4)}` : '—'}
                      </div>
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
