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
  isValidEntityKey,
  type EntityWithMetadata,
  EXPLORER_URL,
} from '@/lib/arkiv';
import type { CivicRecordPayload, ClaimsLadderResult } from '@/lib/types';
import { buildClaimsLadder } from '@/lib/detect';
import { ClaimsLadder } from '@/components/ClaimsLadder';
import { SubmitReportModal } from '@/components/SubmitReportModal';
import { Camera, ArrowLeft, MapPin, CheckCircle2 } from 'lucide-react';
import type { Hex } from 'viem';

export default function CitizenPromisePage({ params }: { params: Promise<{ promiseKey: string }> }) {
  const resolvedParams = use(params);
  const rawKey = decodeURIComponent(resolvedParams.promiseKey);
  const { setUserRole } = useWallet();

  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ladder, setLadder] = useState<ClaimsLadderResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedTx, setReportedTx] = useState<string | null>(null);

  useEffect(() => {
    setUserRole('citizen');
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

      const [stmts, reps, revsData, resps] = await Promise.all([
        fetchStatements(rawKey as Hex),
        fetchGroundReports(rawKey as Hex),
        fetchRecordRevisions(rawKey as Hex),
        fetchAuthorityResponses(rawKey as Hex),
      ]);

      const ladderRes = buildClaimsLadder({
        currentRecord: data.record.payload,
        recordCreatedAtBlock: data.record.createdAt,
        recordCreatorWallet: data.record.creator,
        revisions: revsData.revisions,
        reports: reps.map((r) => ({
          key: r.key,
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          creator: r.creator || '0x0',
          payload: r.payload,
        })),
        statements: stmts.map((s) => ({
          key: s.key,
          blockNumber: s.blockNumber,
          txHash: s.txHash,
          creator: s.creator || '0x0',
          payload: s.payload,
        })),
        responses: resps.map((res) => ({
          key: res.key,
          blockNumber: res.blockNumber,
          txHash: res.txHash,
          creator: res.creator || '0x0',
          payload: res.payload,
        })),
        custodianWallets: [data.record.owner, data.record.creator, ...revsData.custodyChain.map((c) => c.wallet)],
      });

      setLadder(ladderRes);
    } catch (err: any) {
      console.error('Error loading citizen promise data:', err);
      setErrorMessage(err?.message || 'Failed to load promise from blockchain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawKey]);

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
            {errorMessage || `No promise found on blockchain for key ${rawKey.slice(0, 16)}...`}
          </p>
          <Link href="/citizen" className="btn btn-primary btn-md">
            Return to Citizen Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <Link href="/citizen" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Back to Citizen Portal
        </Link>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>
          {recordMeta?.payload.reference_code || rawKey.slice(0, 16)}
        </span>
      </div>

      {reportedTx && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-card)',
            marginBottom: '28px',
            fontSize: '14px',
          }}
        >
          <strong>Report successfully recorded on-chain:</strong>{' '}
          <a
            href={`${EXPLORER_URL}/tx/${reportedTx}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
          >
            View transaction on Tiramisu explorer &rarr;
          </a>
        </div>
      )}

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge" style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', textTransform: 'uppercase', fontSize: '11px' }}>
              Citizen Promise Inspection
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              Read-only Claims Ladder
            </span>
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

        <div>
          <button
            onClick={() => setShowReportModal(true)}
            className="btn btn-primary btn-md"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Camera size={15} />
            <span>File Witness / Complaint</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '350px' }} />
      ) : errorMessage ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--danger)' }}>
          {errorMessage}
        </div>
      ) : ladder ? (
        <div>
          {/* Read-Only Claims Ladder */}
          <ClaimsLadder ladder={ladder} loading={loading} />
        </div>
      ) : null}

      {/* Ground Report Submission Modal */}
      {showReportModal && recordMeta && (
        <SubmitReportModal
          recordEntityKey={recordMeta.key}
          referenceCode={recordMeta.payload.reference_code}
          recordCustodianAddress={recordMeta.owner}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={(txHash) => {
            setReportedTx(txHash || null);
            setShowReportModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
