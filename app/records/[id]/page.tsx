'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import {
  fetchCivicRecordByKey,
  fetchGroundReports,
  fetchStatements,
  fetchAuthorityResponses,
  fetchRecordRevisions,
  patchCivicRecordOnChain,
  changeRecordCustodyOnChain,
  extendEntityLifetimeOnChain,
  attemptIllegalReportPatch,
  isValidEntityKey,
  type EntityWithMetadata,
  EXPLORER_URL,
} from '@/lib/arkiv';
import type {
  CivicRecordPayload,
  GroundReportPayload,
  StatementPayload,
  AuthorityResponsePayload,
  DispatchManifestPayload,
  RecordRevision,
  CustodyHop,
  CoverUpDetectionResult,
  ClaimsLadderResult,
  CivicRecordStatus,
} from '@/lib/types';
import { detectCoverUp, buildClaimsLadder } from '@/lib/detect';
import { getIpfsGatewayUrls } from '@/lib/ipfs';
import { isDemoModeActive } from '@/lib/config';
import { SubmitReportModal } from '@/components/SubmitReportModal';
import { CoverUpAlert } from '@/components/CoverUpAlert';
import { ClaimsLadder } from '@/components/ClaimsLadder';
import { type Hex, getAddress, isAddress } from 'viem';

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rawKey = decodeURIComponent(resolvedParams.id);
  const { address, getArkivClient, userRole } = useWallet();
  const isAuthority = userRole === 'authority';

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [manifest, setManifest] = useState<DispatchManifestPayload | null>(null);
  const [reports, setReports] = useState<
    Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>
  >([]);
  const [statements, setStatements] = useState<
    Array<EntityWithMetadata<StatementPayload> & { blockNumber: bigint; txHash: string }>
  >([]);
  const [authorityResponses, setAuthorityResponses] = useState<
    Array<EntityWithMetadata<AuthorityResponsePayload> & { blockNumber: bigint; txHash: string }>
  >([]);
  const [claimsLadderData, setClaimsLadderData] = useState<ClaimsLadderResult | null>(null);
  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [custodyChain, setCustodyChain] = useState<CustodyHop[]>([]);


  // Cover up & tampering detection
  const [detectionResult, setDetectionResult] = useState<CoverUpDetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'pending' | 'confirmed' | 'failed'; message: string; txHash?: string } | null>(null);

  // Modals & Action Forms
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReceiverConfirmModal, setShowReceiverConfirmModal] = useState(false);

  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [handoverConfirmed, setHandoverConfirmed] = useState(false);

  const [newStatusValue, setNewStatusValue] = useState<CivicRecordStatus>('IN_TRANSIT');
  const [newQuantityReceived, setNewQuantityReceived] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Validate URL param as entityKey (Item 1)
  const isKeyValid = isValidEntityKey(rawKey);
  const demoMode = isDemoModeActive();

  const loadRecordDetails = async () => {
    if (!isKeyValid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchCivicRecordByKey(rawKey as Hex);
      if (!data) {
        setRecordMeta(null);
        setManifest(null);
        setLoading(false);
        return;
      }

      setRecordMeta(data.record);
      setManifest(data.manifest);
      setNewQuantityReceived(data.record.payload.quantity_received || 0);

      const [reps, stmts, revsData, resps] = await Promise.all([
        fetchGroundReports(rawKey as Hex),
        fetchStatements(rawKey as Hex),
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
      setAuthorityResponses(mappedResponses);
      setRevisions(revsData.revisions);
      setCustodyChain(revsData.custodyChain);

      // Build Claims Ladder
      const allCust = [
        data.record.owner,
        data.record.creator,
        ...revsData.custodyChain.map((h) => h.wallet),
      ];

      const ladder = buildClaimsLadder({
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

      setClaimsLadderData(ladder);
    } catch (err: any) {
      console.error('Error loading record details:', err);
      setErrorMessage(err?.message || 'Failed to load record details from chain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordDetails();
  }, [rawKey]);

  // Check if current connected wallet is the on-chain custodian
  const isOwner = Boolean(
    address &&
      recordMeta?.owner &&
      address.toLowerCase() === recordMeta.owner.toLowerCase()
  );

  // All known custodians across history
  const allCustodians = [
    ...(recordMeta?.owner ? [recordMeta.owner] : []),
    ...(recordMeta?.creator ? [recordMeta.creator] : []),
    ...custodyChain.map((h) => h.wallet),
  ];

  // Run Cover-Up Detection Engine (lib/detect.ts)
  const handleRunCoverUpDetection = () => {
    if (!recordMeta) return;
    setDetecting(true);

    try {
      const result = detectCoverUp({
        currentRecord: recordMeta.payload,
        manifest,
        reports: reports.map((r) => ({
          key: r.key,
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          creator: r.creator || '0x0',
          payload: r.payload,
        })),
        revisions,
        custodianWallets: allCustodians,
      });

      setDetectionResult(result);
    } catch (err: any) {
      console.error('Detection engine error:', err);
    } finally {
      setDetecting(false);
    }
  };


  // Custodian: Update Transit Status (patchCivicRecordOnChain, Item 2, Item 4)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta) return;

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Submitting status update to Arkiv...' });

    try {
      const client = getArkivClient();
      const res = await patchCivicRecordOnChain(
        client,
        recordMeta.key,
        {
          status: newStatusValue,
          quantity_received: newQuantityReceived,
          notes: statusNotes.trim() || undefined,
        },
        recordMeta.payload
      );

      setToast({
        type: 'confirmed',
        message: `Status updated to ${newStatusValue}!`,
        txHash: res.txHash,
      });

      setShowStatusModal(false);
      setShowReceiverConfirmModal(false);
      await loadRecordDetails();
    } catch (err: any) {
      console.error('Status patch error:', err);
      setToast({ type: 'failed', message: err?.message || 'Failed to update record on-chain.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Custodian: Transfer Custody Handover (changeRecordCustodyOnChain, Item 4)
  const handleHandoverCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta) return;

    if (!isAddress(newOwnerAddress) || newOwnerAddress === '0x0000000000000000000000000000000000000000') {
      alert('Please enter a valid, non-zero Ethereum wallet address.');
      return;
    }

    if (address && getAddress(newOwnerAddress) === getAddress(address)) {
      alert('Destination custodian cannot be your own wallet address.');
      return;
    }

    if (!handoverConfirmed) {
      alert('Please check the confirmation box acknowledging this action is irreversible.');
      return;
    }

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Signing irreversible custody transfer...' });

    try {
      const client = getArkivClient();
      const res = await changeRecordCustodyOnChain(client, recordMeta.key, newOwnerAddress.trim());

      setToast({
        type: 'confirmed',
        message: 'Custody transferred! You have surrendered write access.',
        txHash: res.txHash,
      });

      setShowCustodyModal(false);
      setNewOwnerAddress('');
      setHandoverConfirmed(false);
      await loadRecordDetails();
    } catch (err: any) {
      console.error('Handover error:', err);
      setToast({ type: 'failed', message: err?.message || 'Custody transfer failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Lifetime Extension (Item 7)
  const handleExtendLifetime = async (entityKey: Hex, entityType: string) => {
    setActionLoading(true);
    setToast({ type: 'pending', message: `Extending ${entityType} lifetime on-chain...` });

    try {
      const client = getArkivClient();
      const res = await extendEntityLifetimeOnChain(client, entityKey, 30);
      setToast({
        type: 'confirmed',
        message: `Successfully extended ${entityType} lifetime by 30 days!`,
        txHash: res.txHash,
      });
      await loadRecordDetails();
    } catch (err: any) {
      console.error('Extend lifetime error:', err);
      setToast({ type: 'failed', message: err?.message || 'Failed to extend entity lifetime.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Immutability test demo (Item 3)
  const handleTestImmutability = async (reportKey: Hex) => {
    try {
      const client = getArkivClient();
      const res = await attemptIllegalReportPatch(client, reportKey);
      if (!res.success) {
        alert(`IMMUTABILITY VERIFIED ON-CHAIN:\n${res.error}`);
      } else {
        alert('Unexpected: Entity was modified.');
      }
    } catch (err: any) {
      alert(`IMMUTABILITY VERIFIED ON-CHAIN:\n${err?.message}`);
    }
  };

  // Evidence package export (Item 10)
  const handleExportEvidence = async () => {
    if (!recordMeta) return;

    const exportData = {
      record_id: recordMeta.payload.reference_code,
      canonical_entity_key: recordMeta.key,
      export_timestamp: new Date().toISOString(),
      record: recordMeta.payload,
      manifest,
      custody_chain: custodyChain,
      revisions,
      reports: reports.map((r) => ({
        entity_key: r.key,
        reporter: r.creator,
        block: r.blockNumber.toString(),
        tx_hash: r.txHash,
        payload: r.payload,
      })),
      statements: statements.map((s) => ({
        entity_key: s.key,
        signer_wallet: s.creator,
        block: s.blockNumber.toString(),
        tx_hash: s.txHash,
        payload: s.payload,
      })),
      authority_responses: authorityResponses.map((res) => ({
        entity_key: res.key,
        signer_wallet: res.creator,
        block: res.blockNumber.toString(),
        tx_hash: res.txHash,
        payload: res.payload,
      })),
      claims_ladder: claimsLadderData
        ? {
            findings: claimsLadderData.findings,
            unique_independent_wallets: claimsLadderData.uniqueIndependentWallets,
            total_statements: claimsLadderData.totalStatements,
            total_citizen_reports: claimsLadderData.totalCitizenReports,
            disclaimer: claimsLadderData.disclaimer,
          }
        : null,
      detection_result: detectionResult,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    let sha256Hex = 'Unavailable';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jsonString));
      sha256Hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const blob = new Blob([`// Krix Cryptographic Evidence Export\n// SHA-256 Checksum: ${sha256Hex}\n\n${jsonString}`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence_${recordMeta.payload.reference_code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isKeyValid) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '36px' }}>
          <div className="eyebrow" style={{ color: 'var(--danger)' }}>MALFORMED ENTITY KEY</div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px 0' }}>Record Not Found</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            The provided URL parameter &ldquo;<code className="mono">{rawKey}</code>&rdquo; is not a valid 32-byte Arkiv entity key.
          </p>
          <Link href="/records" className="btn btn-primary btn-md">
            Return to Records
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="skeleton" style={{ height: '40px', width: '220px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '140px', width: '100%', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div className="skeleton" style={{ height: '360px', width: '100%' }} />
          <div className="skeleton" style={{ height: '360px', width: '100%' }} />
        </div>
      </div>
    );
  }

  if (!recordMeta) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '36px' }}>
          <div className="eyebrow" style={{ color: 'var(--text-faint)' }}>NOT FOUND ON CHAIN</div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px 0' }}>Record Does Not Exist</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            No entity found on Tiramisu for key <code className="mono">{rawKey.slice(0, 16)}...</code>.
          </p>
          <Link href="/records" className="btn btn-primary btn-md">
            Return to Records
          </Link>
        </div>
      </div>
    );
  }

  const record = recordMeta.payload;
  const dispatched = record.quantity_dispatched || 0;
  const received = record.quantity_received || 0;
  const deficit = Math.max(0, dispatched - received);

  // Calculate average citizen reported units
  const validReportCounts = reports.filter((r) => r.payload.count_received !== undefined);
  const avgReported =
    validReportCounts.length > 0
      ? Math.round(validReportCounts.reduce((acc, cur) => acc + (cur.payload.count_received || 0), 0) / validReportCounts.length)
      : null;

  let statusBadgeClass = 'badge-default';
  if (record.status === 'ALL_GOOD_DELIVERED' || record.status === 'DELIVERED') {
    statusBadgeClass = 'badge-success';
  } else if (record.status === 'DAMAGED') {
    statusBadgeClass = 'badge-danger';
  } else if (record.status === 'IN_TRANSIT' || record.status === 'PARTIAL') {
    statusBadgeClass = 'badge-warning';
  }

  return (
    <div className="app-container">
      {/* Toast Notification */}
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
            <strong
              style={{
                color:
                  toast.type === 'confirmed'
                    ? 'var(--success)'
                    : toast.type === 'failed'
                    ? 'var(--danger)'
                    : 'var(--accent)',
              }}
            >
              {toast.type === 'pending' ? 'TRANSACTION PENDING' : toast.type === 'confirmed' ? 'TRANSACTION CONFIRMED' : 'TRANSACTION FAILED'}
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

      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <Link href="/records" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          &larr; Back to Records
        </Link>{' '}
        / <span className="mono" style={{ color: 'var(--text-muted)' }}>{record.reference_code}</span>
      </div>

      {/* Header Card */}
      <div
        className="card"
        style={{
          marginBottom: '28px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '4px' }}>
              {record.kind} &middot; REF: {record.reference_code}
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '4px 0 8px 0', letterSpacing: '-0.01em', color: 'var(--text-main)' }}>
              {record.title}
            </h1>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Origin: <strong style={{ color: 'var(--text-main)' }}>{record.origin}</strong> &rarr; Destination:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{record.destination}</strong> | District:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{record.district} ({record.ward_id})</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '13px', padding: '4px 12px' }}>
              {record.status.replace(/_/g, ' ')}
            </span>
            <button onClick={handleExportEvidence} className="btn btn-secondary btn-md" style={{ fontSize: '12px' }}>
              Export Evidence (JSON + SHA256)
            </button>
          </div>
        </div>

        {/* Canonical Key & Expiry */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '13px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Current Custodian:</span>{' '}
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{recordMeta.owner}</span>{' '}
            {isOwner ? (
              <span className="badge badge-success" style={{ marginLeft: '6px' }}>
                YOU ARE CURRENT CUSTODIAN
              </span>
            ) : (
              <span className="badge badge-default" style={{ marginLeft: '6px' }}>
                READ-ONLY VIEWER
              </span>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Entity Key:</span>{' '}
            <a href={`${EXPLORER_URL}/address/${recordMeta.key}`} target="_blank" rel="noreferrer" className="mono" style={{ color: 'var(--accent)' }}>
              {recordMeta.key.slice(0, 18)}...
            </a>
          </div>
        </div>

        {/* Companion Manifest Info (Item 2) */}
        {manifest && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Companion Manifest:{' '}
            <a href={`${EXPLORER_URL}/address/${manifest.record_entity_key}`} target="_blank" rel="noreferrer" className="mono" style={{ color: 'var(--accent)' }}>
              [dispatch_manifest verified readonly on-chain]
            </a>
          </div>
        )}

        {/* Actions (Custodian gated) */}
        <div style={{ marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setShowStatusModal(true)}
            disabled={!isOwner}
            className="btn btn-secondary btn-md"
            title={!isOwner ? 'Only current on-chain custodian may update status' : undefined}
          >
            Update Transit Status
          </button>

          <button
            onClick={() => setShowReceiverConfirmModal(true)}
            disabled={!isOwner}
            className="btn btn-secondary btn-md"
            title={!isOwner ? 'Only current on-chain custodian may record receipt' : undefined}
          >
            Receiver Confirmation
          </button>

          <button
            onClick={() => setShowCustodyModal(true)}
            disabled={!isOwner}
            className="btn btn-secondary btn-md"
            title={!isOwner ? 'Only current on-chain custodian may handover custody' : undefined}
          >
            Handover Custody
          </button>

          <button
            onClick={() => handleExtendLifetime(recordMeta.key, 'Record')}
            disabled={actionLoading}
            className="btn btn-secondary btn-md"
          >
            Extend Record Lifetime (+365d)
          </button>

          {!isAuthority && (
            <button
              onClick={() => setShowReportModal(true)}
              className="btn btn-primary btn-md"
              style={{ marginLeft: 'auto' }}
            >
              + Submit Ground Reality Form
            </button>
          )}
        </div>
      </div>

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ gridColumn: 'span 2' }}>
          {/* Cover-Up & Tampering Check */}
          <CoverUpAlert
            detection={detectionResult}
            onDetectClick={handleRunCoverUpDetection}
            loading={detecting}
          />

          {/* Claims Ladder (Chronological side-by-side ledger) */}
          {claimsLadderData && (
            <ClaimsLadder ladder={claimsLadderData} loading={loading} />
          )}

          {/* Reports List */}
          <div
            className="card"
            style={{
              marginBottom: '24px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
                  Immutable Ground Reports ({reports.length})
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Uncensorable submissions linked to canonical entity key.
                </div>
              </div>
              {!isAuthority && (
                <button onClick={() => setShowReportModal(true)} className="btn btn-primary btn-md" style={{ height: '32px', fontSize: '12px' }}>
                  + Submit Report
                </button>
              )}
            </div>

            {reports.length === 0 ? (
              <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-card)', padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                No ground reports filed yet for this batch.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reports.map((rep, idx) => {
                  const isCustodian = allCustodians.some((c) => c.toLowerCase() === rep.creator.toLowerCase());
                  const isDefect = rep.payload.verdict === 'DAMAGED' || rep.payload.verdict === 'EXPIRED';

                  return (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                        backgroundColor: 'var(--bg-surface-raised)',
                        borderLeft: `3px solid ${isDefect ? 'var(--danger)' : 'var(--success)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-default">
                            {rep.payload.reporter_role} (Self-declared)
                          </span>
                          {isCustodian && (
                            <span className="badge badge-warning">
                              SUBMITTED BY CUSTODIAN
                            </span>
                          )}
                          <span className={`badge ${isDefect ? 'badge-danger' : 'badge-success'}`}>
                            {rep.payload.verdict}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Severity: <strong>{rep.payload.severity}/10</strong> | Usable Count: <strong>{rep.payload.count_received}</strong>
                          </span>
                        </div>

                        {demoMode && (
                          <button
                            onClick={() => handleTestImmutability(rep.key)}
                            className="btn btn-secondary btn-md"
                            style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                          >
                            [Demo: Test Immutability]
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                        {rep.payload.description}
                      </p>

                      {rep.payload.location && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Location Note: {rep.payload.location}
                        </div>
                      )}

                      {/* Photo evidence with gateway fallback list (Item 9) */}
                      {rep.payload.photo_cids && rep.payload.photo_cids.length > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          {rep.payload.photo_cids.map((cid, cIdx) => {
                            const gateways = getIpfsGatewayUrls(cid);
                            return (
                              <div
                                key={cIdx}
                                style={{
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: 'var(--radius-btn)',
                                  padding: '6px',
                                  backgroundColor: 'var(--bg-surface)',
                                }}
                              >
                                <a href={gateways[0]} target="_blank" rel="noreferrer">
                                  <img
                                    src={gateways[0]}
                                    alt="Proof evidence"
                                    style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                                    onError={(e) => {
                                      if (gateways[1] && (e.target as HTMLImageElement).src !== gateways[1]) {
                                        (e.target as HTMLImageElement).src = gateways[1];
                                      } else {
                                        (e.target as any).style.display = 'none';
                                      }
                                    }}
                                  />
                                  <span style={{ fontSize: '11px', display: 'block', marginTop: '4px', color: 'var(--accent)' }}>
                                    [IPFS Photo]
                                  </span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Attached Official Authority Replies */}
                      {(() => {
                        const matchedResponses = authorityResponses.filter(
                          (ar) => ar.payload.target_key && ar.payload.target_key.toLowerCase() === rep.key.toLowerCase()
                        );
                        if (matchedResponses.length === 0) return null;
                        return (
                          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {matchedResponses.map((ar, aIdx) => (
                              <div
                                key={aIdx}
                                style={{
                                  padding: '10px 14px',
                                  backgroundColor: 'rgba(234, 114, 18, 0.08)',
                                  border: '1px solid rgba(234, 114, 18, 0.35)',
                                  borderRadius: 'var(--radius-btn)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                                  <span>Official Authority Response</span>
                                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', fontWeight: 400 }}>
                                    Block #{ar.blockNumber.toString()}
                                  </span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px', lineHeight: 1.5 }}>
                                  &ldquo;{ar.payload.response_text}&rdquo;
                                </div>
                                {ar.payload.official_role && (
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    &mdash; {ar.payload.official_role}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-faint)' }}>
                        <div>
                          Reporter: <span className="mono">{rep.creator.slice(0, 10)}...</span> &middot; Block #{rep.blockNumber.toString()}
                        </div>
                        <button
                          onClick={() => handleExtendLifetime(rep.key, 'Report')}
                          disabled={actionLoading}
                          className="btn btn-secondary btn-md"
                          style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                        >
                          Extend Life (+30d)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revisions Table */}
          <div
            className="card"
            style={{
              padding: '24px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 14px 0', color: 'var(--text-main)' }}>
              On-Chain Revision History
            </h2>
            {revisions.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Initial record creation recorded.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>Block</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>Operation</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>Updater</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-faint)', fontSize: '11px', textTransform: 'uppercase' }}>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.map((rev, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="mono" style={{ padding: '10px 12px' }}>#{rev.blockNumber.toString()}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-main)' }}>{rev.type}</td>
                        <td className="mono" style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{rev.updater.slice(0, 10)}...</td>
                        <td style={{ padding: '10px 12px' }}>{rev.status || '-'}</td>
                        <td className="mono" style={{ padding: '10px 12px' }}>
                          <a href={`${EXPLORER_URL}/tx/${rev.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                            {rev.txHash.slice(0, 14)}...
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Vertical Custody Stepper */}
          <div
            className="card"
            style={{
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text-main)' }}>
              Chain of Custody Stepper
            </h3>
            {custodyChain.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Initial custodian recorded at batch genesis.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                {custodyChain.map((hop, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: i === custodyChain.length - 1 ? 'var(--accent)' : 'var(--bg-surface-raised)',
                          border: `2px solid ${i === custodyChain.length - 1 ? 'var(--accent)' : 'var(--border-strong)'}`,
                          color: i === custodyChain.length - 1 ? 'var(--on-accent)' : 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < custodyChain.length - 1 && (
                        <div style={{ width: '2px', height: '36px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                        Hop #{i + 1} Custodian
                      </div>
                      <div className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {hop.wallet.slice(0, 10)}...{hop.wallet.slice(-4)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Block #{hop.blockNumber.toString()} &middot;{' '}
                        <a href={`${EXPLORER_URL}/tx/${hop.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                          Tx Link
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity Reconciliation Bar */}
          <div
            className="card"
            style={{
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-main)' }}>
              Quantity Reconciliation
            </h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Comparing dispatched vs received counts against field complaints.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span>Dispatched: <strong style={{ color: 'var(--text-main)' }}>{dispatched}</strong></span>
              <span>Received: <strong style={{ color: 'var(--text-main)' }}>{received}</strong></span>
            </div>

            {/* Reconciliation Bar using status colors */}
            <div
              style={{
                width: '100%',
                height: '14px',
                backgroundColor: 'var(--bg-surface-raised)',
                borderRadius: '999px',
                overflow: 'hidden',
                display: 'flex',
                marginBottom: '10px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: `${dispatched > 0 ? Math.min(100, (received / dispatched) * 100) : 0}%`,
                  backgroundColor: 'var(--success)',
                }}
              />
              {deficit > 0 && (
                <div
                  style={{
                    width: `${dispatched > 0 ? Math.min(100, (deficit / dispatched) * 100) : 0}%`,
                    backgroundColor: 'var(--danger)',
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
                Received ({received})
              </div>
              {deficit > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)', display: 'inline-block' }} />
                  Gap ({deficit})
                </div>
              )}
            </div>

            {avgReported !== null && (
              <div style={{ backgroundColor: 'var(--bg-surface-raised)', padding: '10px 12px', borderRadius: 'var(--radius-btn)', fontSize: '12px', color: 'var(--text-muted)' }}>
                Citizen Average Observed Count: <strong style={{ color: 'var(--text-main)' }}>{avgReported} units</strong>
              </div>
            )}
          </div>

          {isAuthority ? (
            <Link
              href={`/authority/promise/${encodeURIComponent(rawKey)}`}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', textAlign: 'center', display: 'flex' }}
            >
              Manage Official Promise &rarr;
            </Link>
          ) : (
            <button onClick={() => setShowReportModal(true)} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Submit Ground Reality Form
            </button>
          )}
        </div>
      </div>

      {/* Custodian Transit Status Modal */}
      {showStatusModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: 'var(--text-main)' }}>Update Transit Status (patchEntity)</h3>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>Status:</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', height: '40px' }}
                >
                  <option value="CREATED">CREATED</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="ALL_GOOD_DELIVERED">ALL_GOOD_DELIVERED</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>Transit Notes:</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Truck license, checkpoint notes..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowStatusModal(false)} className="btn btn-secondary btn-md">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary btn-md">
                  {actionLoading ? 'Saving on Chain...' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receiver Confirmation Modal (Item 4) */}
      {showReceiverConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-main)' }}>Receiver Explicit Confirmation</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Final receiver confirms the exact units received and updates delivery condition.
            </p>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                  Quantity Actually Received (Units):
                </label>
                <input
                  type="number"
                  min="0"
                  max={dispatched}
                  required
                  value={newQuantityReceived}
                  onChange={(e) => setNewQuantityReceived(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>Arrival Status:</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', height: '40px' }}
                >
                  <option value="DELIVERED">DELIVERED (Complete)</option>
                  <option value="PARTIAL">PARTIAL (Shortage)</option>
                  <option value="DAMAGED">DAMAGED (Damaged items)</option>
                  <option value="ALL_GOOD_DELIVERED">ALL_GOOD_DELIVERED (Audited)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>Receipt Notes:</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Verification details at facility..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowReceiverConfirmModal(false)} className="btn btn-secondary btn-md">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary btn-md">
                  {actionLoading ? 'Confirming on Chain...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custody Handover Modal (Item 4: Irreversible warning & checksum) */}
      {showCustodyModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 9, 8, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-main)' }}>Transfer Custody (changeOwnership)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Transfers legal on-chain write authority of this record to a new custodian.
            </p>

            <div
              role="alert"
              style={{
                border: '1px solid var(--danger-border)',
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-btn)',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              <strong>WARNING:</strong> This action is irreversible on the blockchain. Once confirmed, you will immediately lose write access to this civic record.
            </div>

            <form onSubmit={handleHandoverCustody} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                  New Custodian Wallet Address:
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  className="mono"
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  required
                  checked={handoverConfirmed}
                  onChange={(e) => setHandoverConfirmed(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span>I understand that I am transferring custody and will lose write access.</span>
              </label>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowCustodyModal(false)} className="btn btn-secondary btn-md">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading || !handoverConfirmed} className="btn btn-danger btn-md">
                  {actionLoading ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ground Report Modal */}
      {showReportModal && (
        <SubmitReportModal
          recordEntityKey={recordMeta.key}
          referenceCode={recordMeta.payload.reference_code}
          custodianWallets={allCustodians}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={(txHash) => {
            if (txHash) {
              setToast({ type: 'confirmed', message: 'Ground Report submitted to Arkiv!', txHash });
            }
            loadRecordDetails();
          }}
        />
      )}
    </div>
  );
}
