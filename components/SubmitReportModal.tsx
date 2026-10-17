'use client';

import React, { useState } from 'react';
import { useWallet } from '@/components/WalletContext';
import { submitGroundReportOnChain } from '@/lib/arkiv';
import { stripExifGps, uploadPhotoToIpfs, isValidIpfsCid } from '@/lib/ipfs';
import type { GroundReportPayload, GroundReportVerdict, ReporterRole } from '@/lib/types';

interface SubmitReportModalProps {
  recordId: string;
  onClose: () => void;
  onReportSubmitted: () => void;
}

export function SubmitReportModal({ recordId, onClose, onReportSubmitted }: SubmitReportModalProps) {
  const { getArkivClient, address } = useWallet();

  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState<number>(8);
  const [verdict, setVerdict] = useState<GroundReportVerdict>('DAMAGED');
  const [countReceived, setCountReceived] = useState<number>(300);
  const [description, setDescription] = useState<string>('');
  const [reporterRole, setReporterRole] = useState<ReporterRole>('DOCTOR');
  const [location, setLocation] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [acknowledgedPermanent, setAcknowledgedPermanent] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Check size limit: 5 MB (FR-B4)
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo exceeds 5 MB size limit.');
      return;
    }

    setPhotoUploading(true);
    try {
      // 1. Strip EXIF GPS metadata by default (FR-B4, FR-10)
      const cleanBlob = await stripExifGps(file);

      // 2. Upload to IPFS and obtain CID
      const cid = await uploadPhotoToIpfs(cleanBlob);
      setPhotos((prev) => [...prev, cid]);
    } catch (err: any) {
      alert('Photo processing failed: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acknowledgedPermanent) {
      alert('You must acknowledge that this ground report is permanent, public, and cannot be edited or deleted.');
      return;
    }

    if (!description.trim()) {
      alert('Please provide a short description of the observed ground reality.');
      return;
    }

    setLoading(true);
    try {
      const reportPayload: GroundReportPayload = {
        type: 'ground_report',
        record_id: recordId,
        severity,
        verdict,
        count_received: countReceived,
        description: description.slice(0, 500),
        photo_cids: photos,
        reporter_role: reporterRole,
        location: location.trim() ? location.trim() : null,
      };

      const client = getArkivClient();
      const res = await submitGroundReportOnChain(client, reportPayload);

      alert(`Immutable Ground Report submitted on chain!\nEntity Key: ${res.entityKey}\nTx Hash: ${res.txHash}\nFlags: readonly: true, permissionlessExtension: true`);
      onReportSubmitted();
      onClose();
    } catch (err: any) {
      alert('Failed to submit ground report: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          border: '2px solid #000',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Submit Ground Reality Form</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #999', cursor: 'pointer', padding: '2px 8px' }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>
          Record Target: <strong>{recordId}</strong> | Reporter Address:{' '}
          <span style={{ fontFamily: 'monospace' }}>{address || 'Not connected'}</span>
        </div>

        {/* Warning banner: FR-B7, FR-10 */}
        <div
          style={{
            border: '1px solid #d32f2f',
            backgroundColor: '#ffebee',
            color: '#b71c1c',
            padding: '10px',
            fontSize: '12px',
            marginBottom: '16px',
          }}
        >
          <strong>PERMANENT & PUBLIC ON-CHAIN RECORD:</strong>
          <br />
          This report is written with <code>readonly: true</code>. Once submitted to Arkiv, neither you, government officials, nor database administrators can edit or delete it.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Your Role:</label>
            <select
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value as ReporterRole)}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            >
              <option value="DOCTOR">DOCTOR (Field Doctor / Health Worker)</option>
              <option value="INSPECTOR">INSPECTOR (Government / Quality Inspector)</option>
              <option value="CITIZEN">CITIZEN (Resident / Beneficiary)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Ground Verdict:
            </label>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value as GroundReportVerdict)}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            >
              <option value="DAMAGED">DAMAGED (Damaged / Broken / Unusable)</option>
              <option value="EXPIRED">EXPIRED (Expired medicines or past date)</option>
              <option value="SHORT_QUANTITY">SHORT_QUANTITY (Missing boxes / less than claimed)</option>
              <option value="NOT_RECEIVED">NOT_RECEIVED (Never arrived at facility)</option>
              <option value="ALL_GOOD">ALL_GOOD (Verified intact & complete)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Severity Level (1 = Minor, 10 = Critical Failure): <strong>{severity} / 10</strong>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Quantity Actually Received / Usable:
            </label>
            <input
              type="number"
              min="0"
              value={countReceived}
              onChange={(e) => setCountReceived(parseInt(e.target.value) || 0)}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Description (max 500 characters):
            </label>
            <textarea
              rows={3}
              maxLength={500}
              required
              placeholder="Detail broken seals, soaked boxes, missing batch numbers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
            <div style={{ fontSize: '11px', color: '#666', textAlign: 'right' }}>
              {description.length} / 500
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Photo Proof (IPFS - EXIF GPS stripped automatically):
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={photoUploading}
              style={{ fontSize: '12px' }}
            />
            {photoUploading && <span style={{ fontSize: '11px', marginLeft: '8px' }}>Processing image & uploading to IPFS...</span>}

            {photos.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                <strong>Attached CIDs:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {photos.map((cid, i) => (
                    <li key={i} style={{ fontFamily: 'monospace' }}>
                      {cid.slice(0, 24)}...
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
              Location Note (Optional, general area only):
            </label>
            <input
              type="text"
              placeholder="e.g. PHC OPD Ward 12"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
            <input
              type="checkbox"
              required
              checked={acknowledgedPermanent}
              onChange={(e) => setAcknowledgedPermanent(e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <span style={{ fontSize: '12px' }}>
              I confirm that this ground reality evidence is truthful. I understand that this submission is permanent and public on the blockchain.
            </span>
          </label>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 14px', border: '1px solid #999', background: '#eee', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !acknowledgedPermanent}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: '#000',
                color: '#fff',
                fontWeight: 'bold',
                cursor: loading || !acknowledgedPermanent ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Submitting to Arkiv...' : 'Submit Ground Report (Immutable)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
