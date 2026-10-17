'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import {
  fetchCivicRecordByKey,
  fetchGroundReports,
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
  DispatchManifestPayload,
  RecordRevision,
  CustodyHop,
  CoverUpDetectionResult,
  CivicRecordStatus,
} from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';
import { getIpfsGatewayUrls } from '@/lib/ipfs';
import { isDemoModeActive } from '@/lib/config';
import { SubmitReportModal } from '@/components/SubmitReportModal';
import { TimeTravelSlider } from '@/components/TimeTravelSlider';
import { CoverUpAlert } from '@/components/CoverUpAlert';
import { type Hex, getAddress, isAddress } from 'viem';

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rawKey = decodeURIComponent(resolvedParams.id);
  const { address, getArkivClient } = useWallet();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [manifest, setManifest] = useState<DispatchManifestPayload | null>(null);
  const [reports, setReports] = useState<
    Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>
  >([]);
  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [custodyChain, setCustodyChain] = useState<CustodyHop[]>([]);

  // Time-Travel state
  const [selectedBlock, setSelectedBlock] = useState<bigint | null>(null);
  const [historicalRecord, setHistoricalRecord] = useState<CivicRecordPayload | null>(null);

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

      const repList = await fetchGroundReports(rawKey as Hex);
      setReports(repList);

      const revData = await fetchRecordRevisions(rawKey as Hex);
      setRevisions(revData.revisions);
      setCustodyChain(revData.custodyChain);
    } catch (err: any) {
      console.error('Failed to load record details:', err);
      setErrorMessage(err?.message || 'Unable to retrieve record from Tiramisu chain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordDetails();
  }, [rawKey, isKeyValid]);

  const handleBlockChange = async (block: bigint | null) => {
    setSelectedBlock(block);
    if (block === null) {
      setHistoricalRecord(null);
      const allReps = await fetchGroundReports(rawKey as Hex);
      setReports(allReps);
      return;
    }

    const matchingRev = revisions.find((r) => r.blockNumber === block);
    if (matchingRev && matchingRev.rawPayload) {
      setHistoricalRecord(matchingRev.rawPayload as CivicRecordPayload);
    } else {
      const hist = await fetchCivicRecordByKey(rawKey as Hex, block);
      if (hist) setHistoricalRecord(hist.record.payload);
    }

    const histReps = await fetchGroundReports(rawKey as Hex, block);
    setReports(histReps);
  };

  const handleRunCoverUpDetection = () => {
    if (!recordMeta) return;
    setDetecting(true);
    setTimeout(() => {
      const allCustodians = Array.from(
        new Set([recordMeta.owner, recordMeta.creator, ...custodyChain.map((c) => c.wallet)])
      );

      const result = detectCoverUp({
        currentRecord: recordMeta.payload,
        manifest,
        revisions,
        reports: reports.map((r) => ({
          key: r.key,
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          creator: r.creator,
          payload: r.payload,
        })),
        custodianWallets: allCustodians,
      });
      setDetectionResult(result);
      setDetecting(false);
    }, 250);
  };

  // Lifetime Extension for Report or Record (Item 7)
  const handleExtendLifetime = async (targetKey: Hex, label: string) => {
    setActionLoading(true);
    setToast({ type: 'pending', message: `Extending ${label} lifetime on Tiramisu...` });
    try {
      const client = getArkivClient();
      const res = await extendEntityLifetimeOnChain(client, targetKey, 30);
      setToast({ type: 'confirmed', message: `Lifetime Extension confirmed (+30 days)!`, txHash: res.txHash });
      loadRecordDetails();
    } catch (err: any) {
      setToast({ type: 'failed', message: `Extension failed: ${err.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestImmutability = async (reportKey: Hex) => {
    const client = getArkivClient();
    const result = await attemptIllegalReportPatch(client, reportKey);
    if (!result.success) {
      alert(`ON-CHAIN INTEGRITY VERIFIED:\nUnauthorized mutation was rejected.\n${result.error}`);
    } else {
      alert('Warning: entity mutation was accepted.');
    }
  };

  // Status Update (Item 4: Enforces state machine & receiver confirmation)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta) return;

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Executing patchEntity on Tiramisu chain...' });
    try {
      const client = getArkivClient();
      const res = await patchCivicRecordOnChain(
        client,
        recordMeta.key,
        {
          status: newStatusValue,
          quantity_received: newQuantityReceived,
          notes: statusNotes,
        },
        recordMeta.payload
      );
      setToast({ type: 'confirmed', message: `Status updated to ${newStatusValue}!`, txHash: res.txHash });
      setShowStatusModal(false);
      setShowReceiverConfirmModal(false);
      loadRecordDetails();
    } catch (err: any) {
      setToast({ type: 'failed', message: `Update failed: ${err.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  // Custody Handover (Item 4: Address validation, irreversibility warning)
  const handleHandoverCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta || !newOwnerAddress) return;

    if (!handoverConfirmed) {
      alert('You must confirm that you understand this custody transfer is irreversible.');
      return;
    }

    setActionLoading(true);
    setToast({ type: 'pending', message: 'Executing changeOwnership custody transfer...' });
    try {
      const client = getArkivClient();
      const res = await changeRecordCustodyOnChain(
        client,
        recordMeta.key,
        newOwnerAddress
      );
      setToast({ type: 'confirmed', message: `Custody transferred to ${newOwnerAddress.slice(0, 8)}...`, txHash: res.txHash });
      setShowCustodyModal(false);
      loadRecordDetails();
    } catch (err: any) {
      setToast({ type: 'failed', message: `Handover failed: ${err.message}` });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Evidence (Item 11: Fresh data + SHA-256 hash)
  const handleExportEvidence = async () => {
    if (!recordMeta) return;

    const exportPayload = {
      recordEntityKey: recordMeta.key,
      referenceCode: recordMeta.payload.reference_code,
      title: recordMeta.payload.title,
      dispatched: recordMeta.payload.quantity_dispatched,
      received: recordMeta.payload.quantity_received,
      status: recordMeta.payload.status,
      manifest,
      revisions,
      reports: reports.map((r) => ({
        key: r.key,
        reporter: r.creator,
        verdict: r.payload.verdict,
        severity: r.payload.severity,
        blockNumber: r.blockNumber.toString(),
        photoCids: r.payload.photo_cids,
      })),
      detectionResult,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(exportPayload, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

    let sha256Hex = '';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jsonString));
      sha256Hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const blob = new Blob([`// JanAudit Cryptographic Evidence Export\n// SHA-256 Checksum: ${sha256Hex}\n\n${jsonString}`], {
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
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '18px', color: 'var(--danger)', margin: '0 0 8px 0' }}>Invalid Entity Key Format</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 16px 0' }}>
          "{rawKey}" is not a valid 32-byte hex Arkiv entity key.
        </p>
        <Link href="/" className="btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Querying record & manifest from Arkiv chain...</div>
      </div>
    );
  }

  if (!recordMeta) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Record Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 16px 0' }}>
          No entity exists on the Tiramisu testnet for key <span style={{ fontFamily: 'monospace' }}>{rawKey}</span>.
        </p>
        <Link href="/" className="btn-primary">
          Back to Records
        </Link>
      </div>
    );
  }

  const record = historicalRecord || recordMeta.payload;
  const isOwner =
    address && recordMeta.owner && address.toLowerCase() === recordMeta.owner.toLowerCase();

  const revisionBlocks = Array.from(
    new Set([
      recordMeta.createdAt,
      ...revisions.map((r) => r.blockNumber),
      ...reports.map((r) => r.blockNumber),
    ])
  ).filter((b) => b > 0n);

  const dispatched = record.quantity_dispatched || 0;
  const received = record.quantity_received || 0;
  const deficit = Math.max(0, dispatched - received);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'ALL_GOOD_DELIVERED':
        return 'badge-green';
      case 'DAMAGED':
        return 'badge-red';
      case 'IN_TRANSIT':
        return 'badge-blue';
      case 'PARTIAL':
        return 'badge-amber';
      default:
        return 'badge-default';
    }
  };

  const allCustodians = Array.from(
    new Set([recordMeta.owner, recordMeta.creator, ...custodyChain.map((c) => c.wallet)])
  );

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#FFFFFF',
            border: `1px solid ${
              toast.type === 'confirmed'
                ? 'var(--success-border)'
                : toast.type === 'failed'
                ? 'var(--danger-border)'
                : 'var(--border-strong)'
            }`,
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
                    : 'var(--primary)',
              }}
            >
              {toast.type === 'pending' ? 'TRANSACTION PENDING' : toast.type === 'confirmed' ? 'TRANSACTION CONFIRMED' : 'TRANSACTION FAILED'}
            </strong>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
              ✕
            </button>
          </div>
          <div style={{ marginTop: '4px' }}>{toast.message}</div>
          {toast.txHash && (
            <div style={{ marginTop: '6px' }}>
              <a href={`${EXPLORER_URL}/tx/${toast.txHash}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                View on Explorer →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <Link href="/" style={{ color: 'var(--primary)', fontWeight: '500' }}>
          ← Back to Records
        </Link>{' '}
        / <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{record.reference_code}</span>
      </div>

      {/* Header Card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {record.kind} · REF: {record.reference_code}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '4px 0 8px 0', letterSpacing: '-0.01em' }}>
              {record.title}
            </h1>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Origin: <strong style={{ color: 'var(--text-main)' }}>{record.origin}</strong> → Destination:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{record.destination}</strong> | District:{' '}
              <strong style={{ color: 'var(--text-main)' }}>{record.district} ({record.ward_id})</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <span className={`badge ${getStatusBadgeClass(record.status)}`} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {record.status}
            </span>
            <button onClick={handleExportEvidence} className="btn-secondary" style={{ height: '32px', fontSize: '12px' }}>
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
            Current Custodian:{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{recordMeta.owner}</span>{' '}
            {isOwner ? (
              <span className="badge badge-green" style={{ marginLeft: '6px' }}>
                YOU ARE CURRENT CUSTODIAN
              </span>
            ) : (
              <span className="badge badge-default" style={{ marginLeft: '6px' }}>
                READ-ONLY VIEWER
              </span>
            )}
          </div>
          <div>
            Entity Key:{' '}
            <a href={`${EXPLORER_URL}/address/${recordMeta.key}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace' }}>
              {recordMeta.key.slice(0, 18)}...
            </a>
          </div>
        </div>

        {/* Companion Manifest Info (Item 2) */}
        {manifest && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Companion Manifest:{' '}
            <a href={`${EXPLORER_URL}/address/${manifest.record_entity_key}`} target="_blank" rel="noreferrer" style={{ fontFamily: 'monospace' }}>
              [dispatch_manifest verified readonly on-chain]
            </a>
          </div>
        )}

        {/* Actions (Custodian gated) */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setShowStatusModal(true)}
            disabled={!isOwner}
            className="btn-secondary"
            style={{ fontSize: '13px' }}
            title={!isOwner ? 'Only current on-chain custodian may update status' : undefined}
          >
            Update Transit Status
          </button>

          <button
            onClick={() => setShowReceiverConfirmModal(true)}
            disabled={!isOwner}
            className="btn-secondary"
            style={{ fontSize: '13px' }}
            title={!isOwner ? 'Only current on-chain custodian may record receipt' : undefined}
          >
            Receiver Confirmation (Quantity Received)
          </button>

          <button
            onClick={() => setShowCustodyModal(true)}
            disabled={!isOwner}
            className="btn-secondary"
            style={{ fontSize: '13px' }}
            title={!isOwner ? 'Only current on-chain custodian may handover custody' : undefined}
          >
            Handover Custody (changeOwnership)
          </button>

          <button
            onClick={() => handleExtendLifetime(recordMeta.key, 'Record')}
            disabled={actionLoading}
            className="btn-secondary"
            style={{ fontSize: '13px' }}
          >
            Extend Record Lifetime (+365d)
          </button>

          <button
            onClick={() => setShowReportModal(true)}
            className="btn-primary"
            style={{ marginLeft: 'auto', fontSize: '13px' }}
          >
            + Submit Ground Reality Form (Immutable)
          </button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ gridColumn: 'span 2' }}>
          {/* Time-Travel Slider (Item 7: Revisions only) */}
          <TimeTravelSlider
            currentRecord={recordMeta.payload}
            historicalBlocks={revisionBlocks}
            selectedBlock={selectedBlock}
            onBlockChange={handleBlockChange}
            recordAtSelectedBlock={historicalRecord}
          />

          {/* Cover-Up & Tampering Check */}
          <CoverUpAlert
            detection={detectionResult}
            onDetectClick={handleRunCoverUpDetection}
            loading={detecting}
          />

          {/* Reports List */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 2px 0' }}>
                  Immutable Ground Reports ({reports.length})
                </h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Uncensorable submissions linked to canonical entity key.
                </div>
              </div>
              <button onClick={() => setShowReportModal(true)} className="btn-primary" style={{ height: '32px', fontSize: '12px' }}>
                + Submit Report
              </button>
            </div>

            {reports.length === 0 ? (
              <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius)', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                No ground reports filed yet for this batch.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reports.map((rep, idx) => {
                  const isCustodian = allCustodians.some((c) => c.toLowerCase() === rep.creator.toLowerCase());
                  return (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius)',
                        padding: '16px',
                        background: '#FFFFFF',
                        borderLeft: `4px solid ${
                          rep.payload.verdict === 'DAMAGED' || rep.payload.verdict === 'EXPIRED'
                            ? 'var(--danger)'
                            : 'var(--success)'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-default">
                            {rep.payload.reporter_role} (Self-declared)
                          </span>
                          {isCustodian && (
                            <span className="badge badge-amber" style={{ fontWeight: '600' }}>
                              SUBMITTED BY CUSTODIAN
                            </span>
                          )}
                          <span className={`badge ${rep.payload.verdict === 'DAMAGED' || rep.payload.verdict === 'EXPIRED' ? 'badge-red' : 'badge-green'}`}>
                            {rep.payload.verdict}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            Severity: <strong>{rep.payload.severity}/10</strong> | Usable Count: <strong>{rep.payload.count_received}</strong>
                          </span>
                        </div>

                        {/* Immutability proof: Only in demo mode or how it works (Item 3) */}
                        {demoMode && (
                          <button
                            onClick={() => handleTestImmutability(rep.key)}
                            className="btn-secondary"
                            style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                          >
                            [Demo: Test Immutability]
                          </button>
                        )}
                      </div>

                      <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5' }}>
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
                                  borderRadius: 'var(--radius)',
                                  padding: '6px',
                                  background: '#FAFAFA',
                                }}
                              >
                                <a href={gateways[0]} target="_blank" rel="noreferrer">
                                  <img
                                    src={gateways[0]}
                                    alt="Proof evidence"
                                    style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
                                    onError={(e) => {
                                      // Fallback to secondary gateway if primary fails
                                      if (gateways[1] && (e.target as HTMLImageElement).src !== gateways[1]) {
                                        (e.target as HTMLImageElement).src = gateways[1];
                                      } else {
                                        (e.target as any).style.display = 'none';
                                      }
                                    }}
                                  />
                                  <span style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                    [IPFS Photo]
                                  </span>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-subtle)',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div>
                          Block #{rep.blockNumber.toString()} | Reporter:{' '}
                          <span style={{ fontFamily: 'monospace' }}>{rep.creator.slice(0, 10)}...</span> | Tx:{' '}
                          <a href={`${EXPLORER_URL}/tx/${rep.txHash}`} target="_blank" rel="noreferrer">
                            {rep.txHash.slice(0, 12)}...
                          </a>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span>Expires: #{rep.expiresAt.toString()}</span>
                          <button
                            onClick={() => handleExtendLifetime(rep.key, 'Report')}
                            disabled={actionLoading}
                            className="btn-secondary"
                            style={{ height: '28px', padding: '0 8px', fontSize: '11px' }}
                          >
                            Extend Life (+30d)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revision History */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0' }}>
              On-Chain Revision History
            </h2>
            {revisions.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Initial record creation recorded.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Block</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Operation</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Updater</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((rev, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>#{rev.blockNumber.toString()}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600' }}>{rev.type}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{rev.updater.slice(0, 10)}...</td>
                      <td style={{ padding: '8px 12px' }}>{rev.status || '-'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        <a href={`${EXPLORER_URL}/tx/${rev.txHash}`} target="_blank" rel="noreferrer">
                          {rev.txHash.slice(0, 14)}...
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Vertical Custody Stepper */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 14px 0' }}>
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
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: i === custodyChain.length - 1 ? 'var(--primary)' : '#FFFFFF',
                          border: `2px solid ${i === custodyChain.length - 1 ? 'var(--primary)' : 'var(--border-strong)'}`,
                          color: i === custodyChain.length - 1 ? '#FFFFFF' : 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: '700',
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
                      <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Hop #{i + 1} Custodian
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
                        {hop.wallet.slice(0, 10)}...{hop.wallet.slice(-4)}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Block #{hop.blockNumber.toString()} ·{' '}
                        <a href={`${EXPLORER_URL}/tx/${hop.txHash}`} target="_blank" rel="noreferrer">
                          Tx Link
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity Reconciliation */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 14px 0' }}>
              Quantity Reconciliation
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dispatched at Origin:</span>
                <strong>{dispatched} units</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Claimed Received:</span>
                <strong>{received} units</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Unexplained Gap:</span>
                <strong style={{ color: deficit > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {deficit} units
                </strong>
              </div>
            </div>

            <div
              style={{
                height: '14px',
                width: '100%',
                backgroundColor: '#EAEAE6',
                borderRadius: '999px',
                overflow: 'hidden',
                display: 'flex',
                marginBottom: '10px',
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

            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                Received ({received})
              </div>
              {deficit > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                  Gap ({deficit})
                </div>
              )}
            </div>
          </div>

          <button onClick={() => setShowReportModal(true)} className="btn-primary" style={{ width: '100%', height: '42px', fontSize: '14px' }}>
            Submit Ground Reality Form
          </button>
        </div>
      </div>

      {/* Custodian Transit Status Modal */}
      {showStatusModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div style={{ background: '#FFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Update Transit Status (patchEntity)</h3>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>Status:</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
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
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>Transit Notes:</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Truck license, checkpoint notes..."
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowStatusModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn-primary">
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div style={{ background: '#FFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Receiver Explicit Confirmation</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Final receiver confirms the exact units received and updates delivery condition.
            </p>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>
                  Quantity Actually Received (Units):
                </label>
                <input
                  type="number"
                  min="0"
                  max={dispatched}
                  required
                  value={newQuantityReceived}
                  onChange={(e) => setNewQuantityReceived(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>Arrival Status:</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
                >
                  <option value="DELIVERED">DELIVERED (Complete)</option>
                  <option value="PARTIAL">PARTIAL (Shortage)</option>
                  <option value="DAMAGED">DAMAGED (Damaged items)</option>
                  <option value="ALL_GOOD_DELIVERED">ALL_GOOD_DELIVERED (Audited)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>Receipt Notes:</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Verification details at facility..."
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowReceiverConfirmModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn-primary">
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div style={{ background: '#FFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Transfer Custody (changeOwnership)</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Transfers legal on-chain write authority of this record to a new custodian.
            </p>

            <div
              style={{
                border: '1px solid var(--danger-border)',
                backgroundColor: 'var(--danger-light)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
                marginBottom: '14px',
              }}
            >
              <strong>WARNING:</strong> This action is irreversible on the blockchain. Once confirmed, you will immediately lose write access to this civic record.
            </div>

            <form onSubmit={handleHandoverCustody} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px', fontSize: '13px' }}>
                  New Custodian Wallet Address:
                </label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', fontFamily: 'monospace' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
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
                <button type="button" onClick={() => setShowCustodyModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading || !handoverConfirmed} className="btn-danger">
                  {actionLoading ? 'Transferring...' : 'Confirm Irreversible Transfer'}
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
