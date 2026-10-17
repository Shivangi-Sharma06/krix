'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import {
  fetchCivicRecordByKey,
  fetchStatements,
  fetchGroundReports,
  fetchRecordRevisions,
  fetchAuthorityResponses,
  patchCivicRecordOnChain,
  changeRecordCustodyOnChain,
  submitAuthorityResponseOnChain,
  isValidEntityKey,
  type EntityWithMetadata,
  EXPLORER_URL,
} from '@/lib/arkiv';
import type {
  CivicRecordPayload,
  GroundReportPayload,
  StatementPayload,
  AuthorityResponsePayload,
  RecordRevision,
  CustodyHop,
  ClaimsLadderResult,
  CivicRecordStatus,
} from '@/lib/types';
import { buildClaimsLadder } from '@/lib/detect';
import { ClaimsLadder } from '@/components/ClaimsLadder';
import { Building, ShieldAlert, ArrowLeft, CheckCircle2, AlertTriangle, Truck, MessageSquare, Plus } from 'lucide-react';
import type { Hex } from 'viem';

export default function AuthorityPromisePage({ params }: { params: Promise<{ promiseKey: string }> }) {
  const resolvedParams = use(params);
  const rawKey = decodeURIComponent(resolvedParams.promiseKey);
  const { address, isConnected, getArkivClient, setUserRole } = useWallet();

  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ladder, setLadder] = useState<ClaimsLadderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [reports, setReports] = useState<Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>>([]);
  const [statements, setStatements] = useState<Array<EntityWithMetadata<StatementPayload> & { blockNumber: bigint; txHash: string }>>([]);
  const [responses, setResponses] = useState<Array<EntityWithMetadata<AuthorityResponsePayload> & { blockNumber: bigint; txHash: string }>>([]);
  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [custodyChain, setCustodyChain] = useState<CustodyHop[]>([]);

  // Response Form modal state
  const [selectedTarget, setSelectedTarget] = useState<{
    key: Hex;
    type: 'complaint' | 'statement';
    label: string;
  } | null>(null);
  const [responseText, setResponseText] = useState('');
  const [officialRole, setOfficialRole] = useState('District Health Authority');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'confirmed' | 'failed' | 'pending'; message: string; txHash?: string } | null>(null);

  // Status update modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<CivicRecordStatus>('IN_TRANSIT');
  const [quantityReceived, setQuantityReceived] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => {
    setUserRole('authority');
  }, [setUserRole]);

  const loadData = async () => {
    if (!isValidEntityKey(rawKey)) {
      setErrorMessage('Invalid promise entity key format.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchCivicRecordByKey(rawKey as Hex);
      if (!data) {
        setErrorMessage('Promise record not found on blockchain.');
        setLoading(false);
        return;
      }
      setRecordMeta(data.record);
      setQuantityReceived(data.record.payload.quantity_received || 0);

      const [stmts, reps, revsData, resps] = await Promise.all([
        fetchStatements(rawKey as Hex),
        fetchGroundReports(rawKey as Hex),
        fetchRecordRevisions(rawKey as Hex),
        fetchAuthorityResponses(rawKey as Hex),
      ]);

      const mappedReports = reps.map((r) => ({
        ...r,
        blockNumber: r.createdAt,
        txHash: (r as any).txHash || '',
      }));

      const mappedStatements = stmts.map((s) => ({
        ...s,
        blockNumber: s.createdAt,
        txHash: (s as any).txHash || '',
      }));

      const mappedResponses = resps.map((res) => ({
        ...res,
        blockNumber: res.createdAt,
        txHash: (res as any).txHash || '',
      }));

      setReports(mappedReports);
      setStatements(mappedStatements);
      setResponses(mappedResponses);
      setRevisions(revsData.revisions);
      setCustodyChain(revsData.custodyChain);

      const allCust = [data.record.owner, data.record.creator, ...revsData.custodyChain.map((c) => c.wallet)];

      const ladderRes = buildClaimsLadder({
        currentRecord: data.record.payload,
        recordCreatedAtBlock: data.record.createdAt,
        recordCreatorWallet: data.record.creator,
        revisions: revsData.revisions,
        reports: mappedReports.map((r) => ({
          key: r.key,
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          creator: r.creator || '0x0',
          payload: r.payload,
        })),
        statements: mappedStatements.map((s) => ({
          key: s.key,
          blockNumber: s.blockNumber,
          txHash: s.txHash,
          creator: s.creator || '0x0',
          payload: s.payload,
        })),
        responses: mappedResponses.map((res) => ({
          key: res.key,
          blockNumber: res.blockNumber,
          txHash: res.txHash,
          creator: res.creator || '0x0',
          payload: res.payload,
        })),
        custodianWallets: allCust,
      });

      setLadder(ladderRes);
    } catch (err: any) {
      console.error('Error loading authority promise view:', err);
      setErrorMessage(err?.message || 'Failed to load promise from blockchain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawKey]);

  const isOwner = Boolean(
    address &&
      recordMeta?.owner &&
      address.toLowerCase() === recordMeta.owner.toLowerCase()
  );

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta) return;

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Publishing official status change...' });
    try {
      const client = getArkivClient();
      const res = await patchCivicRecordOnChain(
        client,
        recordMeta.key,
        {
          status: newStatus,
          quantity_received: quantityReceived,
          notes: statusNotes.trim() || undefined,
        },
        recordMeta.payload
      );
      setToast({ type: 'confirmed', message: `Status updated to ${newStatus}!`, txHash: res.txHash });
      setShowStatusModal(false);
      await loadData();
    } catch (err: any) {
      console.error('Status update error:', err);
      setToast({ type: 'failed', message: err?.message || 'Failed to update status on-chain.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendOfficialResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !recordMeta) return;

    if (!responseText.trim()) {
      alert('Please provide response text.');
      return;
    }

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Recording official response on-chain...' });
    try {
      const client = getArkivClient();
      const res = await submitAuthorityResponseOnChain(client, {
        type: 'authority_response',
        record_entity_key: recordMeta.key,
        target_key: selectedTarget.key,
        target_type: selectedTarget.type,
        response_text: responseText.trim(),
        official_role: officialRole.trim() || undefined,
      });

      setToast({ type: 'confirmed', message: 'Official response permanently recorded on-chain!', txHash: res.txHash });
      setSelectedTarget(null);
      setResponseText('');
      await loadData();
    } catch (err: any) {
      console.error('Response submit error:', err);
      setToast({ type: 'failed', message: err?.message || 'Failed to record response.' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
        <div className="skeleton" style={{ height: '32px', width: '220px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '140px', width: '100%', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '320px', width: '100%' }} />
      </div>
    );
  }

  if (!recordMeta) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '36px' }}>
          <div className="eyebrow" style={{ color: 'var(--text-faint)' }}>NOT FOUND ON CHAIN</div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px 0' }}>Promise Record Not Found</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            {errorMessage || `No promise found for key ${rawKey.slice(0, 16)}...`}
          </p>
          <Link href="/authority" className="btn btn-primary btn-md">
            Return to Authority Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--bg-surface-raised)',
            border: `1px solid ${
              toast.type === 'confirmed'
                ? 'var(--success-border)'
                : toast.type === 'failed'
                ? 'var(--danger-border)'
                : 'var(--border-strong)'
            }`,
            borderRadius: 'var(--radius-card)',
            padding: '14px 18px',
            zIndex: 2000,
            maxWidth: '380px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ color: toast.type === 'confirmed' ? 'var(--success)' : toast.type === 'failed' ? 'var(--danger)' : 'var(--accent)' }}>
              {toast.type === 'pending' ? 'TRANSACTION PENDING' : toast.type === 'confirmed' ? 'TRANSACTION CONFIRMED' : 'FAILED'}
            </strong>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
              &times;
            </button>
          </div>
          <div style={{ marginTop: '4px', color: 'var(--text-main)' }}>{toast.message}</div>
          {toast.txHash && (
            <div style={{ marginTop: '6px' }}>
              <a href={`${EXPLORER_URL}/tx/${toast.txHash}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: '11px', color: 'var(--accent)' }}>
                View on Explorer &rarr;
              </a>
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <Link href="/authority" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Back to Authority Portal
        </Link>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>
          {recordMeta?.payload.reference_code || rawKey.slice(0, 16)}
        </span>
      </div>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-strong)', textTransform: 'uppercase', fontSize: '11px' }}>
              Authority Promise Operations
            </span>
            {isOwner && (
              <span className="badge badge-success" style={{ fontSize: '11px' }}>
                YOU HOLD CUSTODY
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
            {recordMeta?.payload.title || 'Loading Promise...'}
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Destination: <strong style={{ color: 'var(--text-main)' }}>{recordMeta?.payload.destination || '—'}</strong> &bull; District:{' '}
            <strong style={{ color: 'var(--text-main)' }}>{recordMeta?.payload.district || '—'}</strong> &bull; Dispatched:{' '}
            <strong style={{ color: 'var(--text-main)' }}>{recordMeta?.payload.quantity_dispatched ?? '—'} units</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowStatusModal(true)}
            disabled={!isOwner}
            className="btn btn-primary btn-md"
            title={!isOwner ? 'Only current on-chain custodian may update status' : undefined}
          >
            Update Official Status
          </button>
          <Link href={`/records/${rawKey}`} className="btn btn-secondary btn-md">
            Full Public View &rarr;
          </Link>
        </div>
      </div>

      {/* Pre-Claim Warning Panel (Critical requirement: Lists complaints AND statements before changing claim) */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          marginBottom: '32px',
          backgroundColor: 'var(--bg-surface-raised)',
          borderLeft: '4px solid var(--border-strong)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldAlert size={18} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
            Pre-Claim On-Chain Evidence Check
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.5 }}>
          Before updating delivery status or claiming completion, inspect all statements from transport/distributors and citizen complaints filed from villages. Any contradiction will be automatically caught by the claims ladder and detection engine.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Statements On Record */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '14px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
              Intermediary Statements ({statements.length})
            </div>
            {statements.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Zero intermediary statements on record.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {statements.map((st) => (
                  <div key={st.key} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{st.payload.party_type}</span>
                      <span className={`badge ${st.payload.condition === 'OK' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                        {st.payload.condition}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                      {st.payload.received_count !== undefined && `Received: ${st.payload.received_count} &bull; `}
                      {st.payload.note}
                    </div>
                    <button
                      onClick={() =>
                        setSelectedTarget({
                          key: st.key,
                          type: 'statement',
                          label: `${st.payload.party_type} statement (#${st.blockNumber.toString()})`,
                        })
                      }
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', height: '22px', padding: '0 8px', marginTop: '4px' }}
                    >
                      Reply with Official Response &rarr;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Citizen Complaints / Witnesses On Record */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '14px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
              Citizen Reports &amp; Witnesses ({reports.length})
            </div>
            {reports.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Zero citizen reports filed yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reports.map((rp) => (
                  <div key={rp.key} style={{ fontSize: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{rp.payload.reporter_role}</span>
                      <span className={`badge ${rp.payload.verdict === 'ALL_GOOD' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                        {rp.payload.verdict}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                      {rp.payload.description}
                    </div>
                    <button
                      onClick={() =>
                        setSelectedTarget({
                          key: rp.key,
                          type: 'complaint',
                          label: `${rp.payload.reporter_role} report (#${rp.blockNumber.toString()})`,
                        })
                      }
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', height: '22px', padding: '0 8px', marginTop: '4px' }}
                    >
                      Reply with Official Response &rarr;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claims Ladder Component */}
      {ladder && (
        <div>
          <ClaimsLadder ladder={ladder} loading={loading} />
        </div>
      )}

      {/* Official Reply Modal */}
      {selectedTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
              Publish Official Response
            </h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Replying to: <strong style={{ color: 'var(--text-main)' }}>{selectedTarget.label}</strong>
            </div>

            <form onSubmit={handleSendOfficialResponse} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Authority Role Label
                </label>
                <input
                  type="text"
                  value={officialRole}
                  onChange={(e) => setOfficialRole(e.target.value)}
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Response Statement (Plain text, permanent on-chain)
                </label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  placeholder="Provide official clarification, recount details, replacement dispatch schedule, or explanation of count differences..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setSelectedTarget(null)} className="btn btn-secondary btn-md">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary btn-md">
                  {actionLoading ? 'Recording Response...' : 'Sign & Record Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custodian Status Modal */}
      {showStatusModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
              Update Official Promise Status
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Only the current on-chain custodian can submit this patch.
            </p>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Official Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', height: '40px', backgroundColor: 'var(--bg-surface-raised)' }}
                >
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="ALL_GOOD_DELIVERED">ALL_GOOD_DELIVERED</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Quantity Received
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
                  Status Notes
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                  placeholder="Official explanation or remarks..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowStatusModal(false)} className="btn btn-secondary btn-md">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary btn-md">
                  {actionLoading ? 'Updating on-chain...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
