'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import {
  fetchCivicRecordById,
  fetchGroundReports,
  fetchRecordRevisions,
  patchCivicRecordOnChain,
  changeRecordCustodyOnChain,
  extendEntityLifetimeOnChain,
  attemptIllegalReportPatch,
  type EntityWithMetadata,
  EXPLORER_URL,
} from '@/lib/arkiv';
import type {
  CivicRecordPayload,
  GroundReportPayload,
  RecordRevision,
  CustodyHop,
  CoverUpDetectionResult,
  CivicRecordStatus,
} from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';
import { getIpfsGatewayUrl } from '@/lib/ipfs';
import { SubmitReportModal } from '@/components/SubmitReportModal';
import { TimeTravelSlider } from '@/components/TimeTravelSlider';
import { CoverUpAlert } from '@/components/CoverUpAlert';

export default function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const recordId = decodeURIComponent(resolvedParams.id);
  const { address, getArkivClient } = useWallet();

  const [loading, setLoading] = useState(true);
  const [recordMeta, setRecordMeta] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [reports, setReports] = useState<
    Array<EntityWithMetadata<GroundReportPayload> & { blockNumber: bigint; txHash: string }>
  >([]);
  const [revisions, setRevisions] = useState<RecordRevision[]>([]);
  const [custodyChain, setCustodyChain] = useState<CustodyHop[]>([]);

  // Time-Travel state
  const [selectedBlock, setSelectedBlock] = useState<bigint | null>(null);
  const [historicalRecord, setHistoricalRecord] = useState<CivicRecordPayload | null>(null);

  // Cover up detection
  const [detectionResult, setDetectionResult] = useState<CoverUpDetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);

  // UI Modals & Actions
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [newStatusValue, setNewStatusValue] = useState<CivicRecordStatus>('DELIVERED');
  const [newQuantityReceived, setNewQuantityReceived] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadRecordDetails = async () => {
    setLoading(true);
    try {
      const rec = await fetchCivicRecordById(recordId);
      setRecordMeta(rec);
      if (rec) {
        setNewQuantityReceived(rec.payload.quantity_received || 0);
      }

      const repList = await fetchGroundReports(recordId);
      setReports(repList);

      const revData = await fetchRecordRevisions(recordId, rec?.key);
      setRevisions(revData.revisions);
      setCustodyChain(revData.custodyChain);
    } catch (err) {
      console.error('Failed to load record details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordDetails();
  }, [recordId]);

  // Handle time-travel block selection
  const handleBlockChange = async (block: bigint | null) => {
    setSelectedBlock(block);
    if (block === null) {
      setHistoricalRecord(null);
      // Reload reports at head
      const allReps = await fetchGroundReports(recordId);
      setReports(allReps);
      return;
    }

    // Find state at that block from revisions or query with atBlock
    const matchingRev = revisions.find((r) => r.blockNumber === block);
    if (matchingRev && matchingRev.rawPayload) {
      setHistoricalRecord(matchingRev.rawPayload as CivicRecordPayload);
    } else {
      const hist = await fetchCivicRecordById(recordId, block);
      if (hist) setHistoricalRecord(hist.payload);
    }

    // Filter reports that existed up to that block
    const histReps = await fetchGroundReports(recordId, block);
    setReports(histReps);
  };

  // Run cover up detection
  const handleRunCoverUpDetection = () => {
    if (!recordMeta) return;
    setDetecting(true);
    setTimeout(() => {
      const result = detectCoverUp({
        currentRecord: recordMeta.payload,
        revisions,
        reports: reports.map((r) => ({
          key: r.key,
          blockNumber: r.blockNumber,
          txHash: r.txHash,
          creator: r.creator,
          payload: r.payload,
        })),
      });
      setDetectionResult(result);
      setDetecting(false);
    }, 400);
  };

  // Lifetime Extension (FR-B3)
  const handleExtendLifetime = async (reportKey: string) => {
    setActionLoading(true);
    try {
      const client = getArkivClient();
      const res = await extendEntityLifetimeOnChain(client, reportKey as any, 30);
      alert(`Lifetime Extension granted on Arkiv!\nNew Expiration Block: ${res.expiresAt}\nTx Hash: ${res.txHash}`);
      loadRecordDetails();
    } catch (err: any) {
      alert('Lifetime extension error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Immutability test (FR-B2, Acceptance Criteria 2)
  const handleTestImmutability = async (reportKey: string) => {
    const client = getArkivClient();
    const result = await attemptIllegalReportPatch(client, reportKey as any);
    if (!result.success) {
      alert(`ON-CHAIN INTEGRITY VERIFIED:\nAttempted unauthorized edit failed as expected.\nError: ${result.error}\nReports with readonly: true cannot be modified.`);
    } else {
      alert('Unexpected: entity mutation was accepted.');
    }
  };

  // Custodian Status Update (FR-A3)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta) return;
    setActionLoading(true);
    try {
      const client = getArkivClient();
      await patchCivicRecordOnChain(
        client,
        recordMeta.key,
        recordId,
        {
          status: newStatusValue,
          quantity_received: newQuantityReceived,
          notes: statusNotes,
        },
        recordMeta.payload
      );
      alert(`Official record updated to ${newStatusValue}!`);
      setShowStatusModal(false);
      loadRecordDetails();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Custody Handover (FR-A2)
  const handleHandoverCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordMeta || !newOwnerAddress) return;
    setActionLoading(true);
    try {
      const client = getArkivClient();
      await changeRecordCustodyOnChain(
        client,
        recordMeta.key,
        recordId,
        newOwnerAddress as any
      );
      alert(`Custody transferred to ${newOwnerAddress}!`);
      setShowCustodyModal(false);
      loadRecordDetails();
    } catch (err: any) {
      alert('Error transferring custody: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Evidence Export (FR-C8)
  const handleExportEvidence = () => {
    window.print();
  };

  if (loading) {
    return <div style={{ padding: '30px', textAlign: 'center' }}>Loading record from Arkiv chain...</div>;
  }

  if (!recordMeta) {
    return (
      <div style={{ border: '1px solid #ccc', padding: '30px', textAlign: 'center' }}>
        Record <strong>{recordId}</strong> not found.{' '}
        <Link href="/" style={{ color: '#0066cc' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const record = historicalRecord || recordMeta.payload;
  const isOwner =
    address && recordMeta.owner && address.toLowerCase() === recordMeta.owner.toLowerCase();

  // All historical block heights for slider
  const revisionBlocks = Array.from(
    new Set([
      recordMeta.createdAt,
      ...revisions.map((r) => r.blockNumber),
      ...reports.map((r) => r.blockNumber),
    ])
  ).filter((b) => b > 0n);

  // Quantity reconciliation
  const dispatched = record.quantity_dispatched || 0;
  const received = record.quantity_received || 0;
  const reportedDamaged = reports
    .filter((r) => r.payload.verdict === 'DAMAGED' || r.payload.verdict === 'EXPIRED')
    .reduce((sum, r) => sum + (r.payload.count_received || 0), 0);

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '12px', fontSize: '13px' }}>
        <Link href="/" style={{ color: '#0066cc' }}>
          ← Back to Dashboard
        </Link>{' '}
        / <span style={{ fontFamily: 'monospace' }}>{record.record_id}</span>
      </div>

      {/* Record Header (FR-A4) */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '16px',
          background: '#fff',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
              RECORD ID: {record.record_id} | CATEGORY: {record.kind}
            </div>
            <h1 style={{ margin: '4px 0 8px 0', fontSize: '22px' }}>{record.title}</h1>
            <div style={{ fontSize: '13px', color: '#444' }}>
              Origin: <strong>{record.origin || 'N/A'}</strong> → Destination: <strong>{record.destination || 'N/A'}</strong> | District: <strong>{record.district} ({record.ward_id})</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#666' }}>OFFICIAL STATUS</div>
            <div
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '4px 10px',
                fontSize: '13px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                border: '1px solid #000',
                background:
                  record.status === 'ALL_GOOD_DELIVERED' || record.status === 'DELIVERED'
                    ? '#e8f5e9'
                    : record.status === 'DAMAGED'
                    ? '#ffebee'
                    : '#f5f5f5',
              }}
            >
              {record.status}
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <button
                onClick={handleExportEvidence}
                style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #999', background: '#eee', cursor: 'pointer' }}
              >
                📄 Export Evidence Report
              </button>
            </div>
          </div>
        </div>

        {/* Custodian & On-chain info */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #eee',
            fontSize: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            Current Custodian:{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{recordMeta.owner}</span>{' '}
            {isOwner && (
              <span style={{ color: '#2e7d32', fontWeight: 'bold', marginLeft: '6px' }}>
                [YOU ARE CURRENT CUSTODIAN]
              </span>
            )}
          </div>
          <div>
            Entity Key:{' '}
            <a
              href={`${EXPLORER_URL}/address/${recordMeta.key}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontFamily: 'monospace', color: '#0066cc' }}
            >
              {recordMeta.key.slice(0, 16)}...
            </a>
          </div>
        </div>

        {/* Custodian Actions (Role-aware UI: FR-D3) */}
        <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowStatusModal(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: '#eee',
              border: '1px solid #999',
              cursor: 'pointer',
            }}
          >
            ✏️ Update Status / Counts (Custodian)
          </button>
          <button
            onClick={() => setShowCustodyModal(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: '#eee',
              border: '1px solid #999',
              cursor: 'pointer',
            }}
          >
            🤝 Handover Custody (changeOwnership)
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Submit Ground Reality Form (Immutable)
          </button>
        </div>
      </div>

      {/* Custody Chain (FR-A2) */}
      <div style={{ border: '1px solid #ccc', padding: '16px', background: '#fff', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Chain of Custody (A → B → C)</h3>
        {custodyChain.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#666' }}>Initial custody recorded at batch creation.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
            {custodyChain.map((hop, i) => (
              <React.Fragment key={i}>
                <div style={{ border: '1px solid #999', padding: '8px 12px', background: '#fafafa' }}>
                  <div style={{ fontWeight: 'bold' }}>Hop #{i + 1}: Custodian</div>
                  <div style={{ fontFamily: 'monospace' }}>{hop.wallet.slice(0, 10)}...{hop.wallet.slice(-4)}</div>
                  <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
                    Block #{hop.blockNumber.toString()} |{' '}
                    <a
                      href={`${EXPLORER_URL}/tx/${hop.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0066cc' }}
                    >
                      [Tx]
                    </a>
                  </div>
                </div>
                {i < custodyChain.length - 1 && <span style={{ fontSize: '16px', fontWeight: 'bold' }}>→</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Quantity Reconciliation (FR-A4, FR-C6) */}
      <div style={{ border: '1px solid #ccc', padding: '16px', background: '#fff', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Quantity Reconciliation Bar</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={{ border: '1px solid #ccc', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '11px', color: '#666' }}>DISPATCHED (ORIGIN)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{dispatched} units</div>
          </div>
          <div style={{ border: '1px solid #ccc', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '11px', color: '#666' }}>CLAIMED RECEIVED (OFFICIAL)</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{received} units</div>
          </div>
          <div style={{ border: '1px solid #ccc', padding: '10px', background: '#fafafa' }}>
            <div style={{ fontSize: '11px', color: '#666' }}>UNEXPLAINED DEFICIT</div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: dispatched - received > 0 ? '#b71c1c' : '#2e7d32',
              }}
            >
              {dispatched - received} units
            </div>
          </div>
        </div>
      </div>

      {/* Catch the Cover-Up: Time-Travel Slider (Module C) */}
      <TimeTravelSlider
        currentRecord={recordMeta.payload}
        historicalBlocks={revisionBlocks}
        selectedBlock={selectedBlock}
        onBlockChange={handleBlockChange}
        recordAtSelectedBlock={historicalRecord}
      />

      {/* Detect Cover-Up Section */}
      <CoverUpAlert
        detection={detectionResult}
        onDetectClick={handleRunCoverUpDetection}
        loading={detecting}
      />

      {/* Reports Feed (Module B, FR-B5) */}
      <div style={{ border: '1px solid #ccc', padding: '16px', background: '#fff', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Ground Reality Reports ({reports.length})</h3>
            <span style={{ fontSize: '12px', color: '#666' }}>
              Permanent, tamper-evident citizen & inspector reports. Readonly on-chain.
            </span>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: '#000',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + File Report
          </button>
        </div>

        {reports.length === 0 ? (
          <div style={{ border: '1px dashed #ccc', padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
            No ground reality reports filed yet. Click "+ File Report" to submit the first immutable report.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map((rep, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #ccc',
                  padding: '12px',
                  background: rep.payload.verdict === 'DAMAGED' || rep.payload.verdict === 'EXPIRED' ? '#fff9f9' : '#fafafa',
                  borderLeft: `4px solid ${
                    rep.payload.verdict === 'DAMAGED' || rep.payload.verdict === 'EXPIRED' ? '#b71c1c' : '#2e7d32'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <span
                      style={{
                        padding: '2px 6px',
                        background: '#000',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        marginRight: '8px',
                      }}
                    >
                      {rep.payload.reporter_role}
                    </span>
                    <strong style={{ fontSize: '13px' }}>{rep.payload.verdict}</strong>
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                      (Severity: {rep.payload.severity}/10 | Count Usable: {rep.payload.count_received})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        background: '#e0e0e0',
                        padding: '2px 6px',
                        border: '1px solid #999',
                      }}
                    >
                      🔒 Immutable (readonly)
                    </span>
                    <button
                      onClick={() => handleTestImmutability(rep.key)}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: '#fff',
                        border: '1px solid #999',
                        cursor: 'pointer',
                      }}
                      title="Proves on-chain that this report cannot be edited"
                    >
                      Test Immutability
                    </button>
                  </div>
                </div>

                <p style={{ margin: '6px 0', fontSize: '13px' }}>{rep.payload.description}</p>

                {rep.payload.photo_cids && rep.payload.photo_cids.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {rep.payload.photo_cids.map((cid, cIdx) => (
                      <div key={cIdx} style={{ border: '1px solid #ccc', padding: '4px', background: '#fff' }}>
                        <a href={getIpfsGatewayUrl(cid)} target="_blank" rel="noreferrer">
                          <img
                            src={getIpfsGatewayUrl(cid)}
                            alt="Evidence proof"
                            style={{ width: '80px', height: '60px', objectFit: 'cover', display: 'block' }}
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                          <span style={{ fontSize: '10px', color: '#0066cc', display: 'block', marginTop: '2px' }}>
                            [IPFS Photo]
                          </span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px dashed #ddd',
                    fontSize: '11px',
                    color: '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div>
                    Block #{rep.blockNumber.toString()} | Reporter:{' '}
                    <span style={{ fontFamily: 'monospace' }}>{rep.creator.slice(0, 10)}...</span> | Tx:{' '}
                    <a
                      href={`${EXPLORER_URL}/tx/${rep.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0066cc' }}
                    >
                      {rep.txHash.slice(0, 12)}...
                    </a>
                  </div>

                  {/* Lifetime Extension (FR-B3) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Expires At Block: #{rep.expiresAt.toString()}</span>
                    <button
                      onClick={() => handleExtendLifetime(rep.key)}
                      disabled={actionLoading}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#eee',
                        border: '1px solid #999',
                        cursor: 'pointer',
                      }}
                    >
                      ⏳ Extend Life (+30 days)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revision History (FR-C1) */}
      <div style={{ border: '1px solid #ccc', padding: '16px', background: '#fff' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>Wikipedia-Style Revision History</h3>
        {revisions.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#666' }}>No revisions yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '6px', textAlign: 'left' }}>Block #</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Updater Wallet</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Updated Status</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((rev, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '6px', fontFamily: 'monospace' }}>#{rev.blockNumber.toString()}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold' }}>{rev.type}</td>
                  <td style={{ padding: '6px', fontFamily: 'monospace' }}>{rev.updater}</td>
                  <td style={{ padding: '6px' }}>{rev.status || '-'}</td>
                  <td style={{ padding: '6px', fontFamily: 'monospace' }}>
                    <a
                      href={`${EXPLORER_URL}/tx/${rev.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#0066cc' }}
                    >
                      {rev.txHash.slice(0, 16)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', border: '2px solid #000', padding: '20px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Update Civic Record (patchEntity)</h3>
            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Status:</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as CivicRecordStatus)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
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
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Quantity Received:</label>
                <input
                  type="number"
                  min="0"
                  value={newQuantityReceived}
                  onChange={(e) => setNewQuantityReceived(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Notes:</label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Official inspection audit note..."
                  style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  style={{ padding: '6px 12px', border: '1px solid #999', background: '#eee', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    background: '#000',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Patching on Arkiv...' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custody Handover Modal */}
      {showCustodyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', border: '2px solid #000', padding: '20px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Transfer Custody (changeOwnership)</h3>
            <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0' }}>
              Transfers legal custody of this record to a new custodian wallet. Previous owner will lose patchEntity rights.
            </p>
            <form onSubmit={handleHandoverCustody} style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>New Custodian Address:</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #999', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCustodyModal(false)}
                  style={{ padding: '6px 12px', border: '1px solid #999', background: '#eee', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    background: '#000',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Transferring on Arkiv...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ground Report Modal */}
      {showReportModal && (
        <SubmitReportModal
          recordId={record.record_id}
          onClose={() => setShowReportModal(false)}
          onReportSubmitted={loadRecordDetails}
        />
      )}
    </div>
  );
}
