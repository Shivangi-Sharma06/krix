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
import type { CivicRecordPayload, StatementPayload, ClaimsLadderResult } from '@/lib/types';
import { buildClaimsLadder } from '@/lib/detect';
import { StatementForm } from '@/components/StatementForm';
import { ClaimsLadder } from '@/components/ClaimsLadder';
import { Truck, ArrowLeft, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import type { Hex } from 'viem';

export default function PartyPromiseStatementPage({ params }: { params: Promise<{ promiseKey: string }> }) {
  const resolvedParams = use(params);
  const rawKey = decodeURIComponent(resolvedParams.promiseKey);
  const { setUserRole } = useWallet();

  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTx, setSubmittedTx] = useState<string | null>(null);
  const [ladder, setLadder] = useState<ClaimsLadderResult | null>(null);

  useEffect(() => {
    setUserRole('party');
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
      console.error('Error loading promise data for party:', err);
      setErrorMessage(err?.message || 'Failed to load promise from blockchain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [rawKey]);

  // Derive allowed village labels: origin, destination, ward_id
  const villagesList: string[] = [];
  if (recordMeta?.payload.destination) villagesList.push(recordMeta.payload.destination);
  if (recordMeta?.payload.origin) villagesList.push(recordMeta.payload.origin);
  if (recordMeta?.payload.ward_id) villagesList.push(`Ward ${recordMeta.payload.ward_id}`);
  if (recordMeta?.payload.district) villagesList.push(`${recordMeta.payload.district} District Hub`);

  return (
    <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <Link href="/party" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ArrowLeft size={14} /> Back to Promises List
        </Link>
        <span style={{ color: 'var(--text-faint)' }}>/</span>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>
          {recordMeta?.payload.reference_code || rawKey.slice(0, 16)}
        </span>
      </div>

      {/* Header Info */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge" style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', textTransform: 'uppercase', fontSize: '11px' }}>
            Intermediary Statement Entry
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
            Entity Type: statement (Readonly &middot; Permissionless Extension)
          </span>
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 8px 0' }}>
          {recordMeta?.payload.title || 'Loading Promise...'}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: 0 }}>
          Record your arrival counts, transit condition, and observations. Your statement is published directly to Arkiv as an unalterable claim.
        </p>
      </div>

      {submittedTx && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-card)',
            marginBottom: '32px',
            fontSize: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CheckCircle2 size={18} />
            <strong>Statement successfully recorded on-chain!</strong>
          </div>
          <div>
            Transaction:{' '}
            <a
              href={`${EXPLORER_URL}/tx/${submittedTx}`}
              target="_blank"
              rel="noreferrer"
              className="mono"
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              {submittedTx}
            </a>
          </div>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: '350px', marginBottom: '32px' }} />
      ) : errorMessage ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--danger)', marginBottom: '32px' }}>
          {errorMessage}
        </div>
      ) : recordMeta ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', marginBottom: '40px' }}>
          {/* Statement Form */}
          <div className="card" style={{ padding: '28px', backgroundColor: 'var(--bg-surface)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text-main)' }}>
              Submit Party Statement
            </h2>
            <StatementForm
              promiseKey={rawKey as Hex}
              referenceCode={recordMeta.payload.reference_code}
              allowedVillages={villagesList}
              onSuccess={(tx) => {
                setSubmittedTx(tx);
                loadData();
              }}
            />
          </div>

          {/* Promise Summary Card */}
          <div>
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <div className="eyebrow" style={{ marginBottom: '8px' }}>
                PROMISE SPECIFICATIONS
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '14px' }}>
                {recordMeta.payload.title}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <div>
                  Origin: <strong style={{ color: 'var(--text-main)' }}>{recordMeta.payload.origin}</strong>
                </div>
                <div>
                  Destination: <strong style={{ color: 'var(--text-main)' }}>{recordMeta.payload.destination}</strong>
                </div>
                <div>
                  Dispatched Quantity: <strong style={{ color: 'var(--text-main)' }}>{recordMeta.payload.quantity_dispatched} units</strong>
                </div>
                <div>
                  Current Official Status: <strong style={{ color: 'var(--text-main)' }}>{recordMeta.payload.status}</strong>
                </div>
                <div>
                  Entity Key: <span className="mono" style={{ fontSize: '11px' }}>{rawKey}</span>
                </div>
              </div>
            </div>

            <div
              className="card"
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                <Info size={16} /> Notice on Role Verification
              </div>
              <div>
                All intermediary statements are self-declared. Krix does not verify whether you are a certified logistics driver or clinic nurse. Anyone who signs with a wallet has their claim displayed with a &quot;(self-declared)&quot; badge.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Claims Ladder View */}
      {ladder && (
        <div>
          <ClaimsLadder ladder={ladder} loading={loading} />
        </div>
      )}
    </div>
  );
}
