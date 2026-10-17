'use client';

import React, { useState } from 'react';
import { useWallet } from '@/components/WalletContext';
import { submitGroundReportOnChain } from '@/lib/arkiv';
import { stripExifGps, uploadPhotoToIpfs, sniffImageMimeType } from '@/lib/ipfs';
import type { GroundReportPayload, GroundReportVerdict, ReporterRole } from '@/lib/types';
import { DETECTION_CONFIG } from '@/lib/constants';

interface SubmitReportModalProps {
  recordEntityKey: `0x${string}`;
  referenceCode: string;
  custodianWallets?: string[];
  onClose: () => void;
  onReportSubmitted: (txHash?: string) => void;
}

export function SubmitReportModal({
  recordEntityKey,
  referenceCode,
  custodianWallets = [],
  onClose,
  onReportSubmitted,
}: SubmitReportModalProps) {
  const { getArkivClient, address, isConnected, isCorrectNetwork, switchNetwork } = useWallet();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [severity, setSeverity] = useState<number>(8);
  const [verdict, setVerdict] = useState<GroundReportVerdict>('DAMAGED');
  const [countReceived, setCountReceived] = useState<number>(300);
  const [description, setDescription] = useState<string>('');
  const [reporterRole, setReporterRole] = useState<ReporterRole>('DOCTOR');
  const [locationConsent, setLocationConsent] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [acknowledgedPermanent, setAcknowledgedPermanent] = useState(false);

  // Check if reporter is past or current custodian (Item 5)
  const isReporterCustodian =
    address && custodianWallets.some((c) => c.toLowerCase() === address.toLowerCase());

  // Check daily limit in localStorage (Item 5)
  const checkDailyLimit = (): boolean => {
    if (!address) return true;
    const today = new Date().toISOString().slice(0, 10);
    const key = `janaudit_reports_${address.toLowerCase()}_${recordEntityKey}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    return count < DETECTION_CONFIG.CLIENT_DAILY_REPORT_LIMIT;
  };

  const incrementDailyCount = () => {
    if (!address) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `janaudit_reports_${address.toLowerCase()}_${recordEntityKey}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (count + 1).toString());
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (photos.length >= DETECTION_CONFIG.MAX_REPORT_PHOTOS) {
      alert(`Maximum of ${DETECTION_CONFIG.MAX_REPORT_PHOTOS} photos allowed per report.`);
      return;
    }

    if (file.size > DETECTION_CONFIG.MAX_PHOTO_BYTES) {
      alert('Photo exceeds 5 MB size limit.');
      return;
    }

    setPhotoUploading(true);
    try {
      // Sniff MIME type from bytes (Item 5)
      const mime = await sniffImageMimeType(file);
      if (!mime) {
        throw new Error('Unsupported image format. Only JPEG, PNG, and WebP are allowed.');
      }

      // Strip EXIF GPS
      const cleanBlob = await stripExifGps(file);

      // Upload to IPFS (fails loudly if invalid)
      const cid = await uploadPhotoToIpfs(cleanBlob);
      setPhotos((prev) => [...prev, cid]);
    } catch (err: any) {
      alert('Photo upload failed: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Require wallet on correct network (Item 5)
    if (!isConnected) {
      setErrorMessage('Please connect your Web3 wallet before submitting a report.');
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!checkDailyLimit()) {
      setErrorMessage(
        `Client Daily Limit: You have reached the maximum of ${DETECTION_CONFIG.CLIENT_DAILY_REPORT_LIMIT} reports per day for this record from your wallet address.`
      );
      return;
    }

    if (!countReceived || countReceived < 0 || !Number.isInteger(countReceived)) {
      setErrorMessage('Count received must be a non-negative integer.');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a description of the observed ground reality.');
      return;
    }

    setLoading(true);
    try {
      const reportPayload: GroundReportPayload = {
        type: 'ground_report',
        record_entity_key: recordEntityKey,
        severity,
        verdict,
        count_received: countReceived,
        description: description.slice(0, 500),
        photo_cids: photos,
        reporter_role: reporterRole,
        location: locationConsent && locationText.trim() ? locationText.trim() : null,
        is_custodian_submission: !!isReporterCustodian,
      };

      const client = getArkivClient();
      const res = await submitGroundReportOnChain(client, reportPayload);

      incrementDailyCount();
      onReportSubmitted(res.txHash);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit ground report:', err);
      setErrorMessage(err?.message || 'Failed to submit report to Arkiv.');
    } finally {
      setLoading(false);
    }
  };

  const verdicts: Array<{ id: GroundReportVerdict; label: string; desc: string }> = [
    { id: 'DAMAGED', label: 'Damaged Goods', desc: 'Broken seals, soaked boxes, shattered vials' },
    { id: 'EXPIRED', label: 'Expired Stock', desc: 'Past labelled expiration date or degraded' },
    { id: 'SHORT_QUANTITY', label: 'Short Quantity', desc: 'Received fewer items than claimed on dispatch' },
    { id: 'NOT_RECEIVED', label: 'Not Received', desc: 'Shipment has not arrived at the facility' },
    { id: 'ALL_GOOD', label: 'All Good', desc: 'Verified intact and complete' },
  ];

  return (
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
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 2px 0' }}>
              Submit Ground Reality Form
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Ref: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{referenceCode}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              padding: '4px 10px',
              color: 'var(--text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Required Disclosure Notice */}
        <div
          style={{
            border: '1px solid var(--danger-border)',
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '12px 14px',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <strong>This report will be permanent and public.</strong> No one can edit or delete it once submitted to the Arkiv blockchain.
        </div>

        {/* Reporter Custodian Notice (Item 5) */}
        {isReporterCustodian && (
          <div
            style={{
              border: '1px solid var(--warning-border)',
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning)',
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <strong>Custodian Wallet Detected:</strong> Your wallet is identified as an official custodian of this record. Your submission will be marked "submitted by custodian" and excluded from independent auditor counts.
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              border: '1px solid var(--danger-border)',
              backgroundColor: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px' }}>
          {/* Reporter Role (Item 5: Self-declared note) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Reporter Role</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Self-declared, not attested)</span>
            </div>
            <select
              value={reporterRole}
              onChange={(e) => setReporterRole(e.target.value as ReporterRole)}
              style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
            >
              <option value="DOCTOR">Doctor (Facility / Field Doctor)</option>
              <option value="INSPECTOR">Inspector (Health / Quality Auditor)</option>
              <option value="CITIZEN">Citizen (Beneficiary / Resident)</option>
            </select>
          </div>

          {/* Verdict Radio Cards */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>
              Observed Verdict
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              {verdicts.map((v) => {
                const selected = verdict === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setVerdict(v.id)}
                    style={{
                      border: `1px solid ${selected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: selected ? 'var(--primary-light)' : '#FFF',
                      borderRadius: 'var(--radius)',
                      padding: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '13px', color: selected ? 'var(--primary)' : 'var(--text-main)' }}>
                      {v.label}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {v.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Severity Level</label>
              <span style={{ fontWeight: '700', color: severity >= 7 ? 'var(--danger)' : 'var(--text-main)' }}>
                {severity} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value))}
              style={{ width: '100%', height: '6px', cursor: 'pointer' }}
            />
          </div>

          {/* Quantity Count */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Count Received / Usable (Integer)
            </label>
            <input
              type="number"
              min="0"
              required
              value={countReceived}
              onChange={(e) => setCountReceived(parseInt(e.target.value) || 0)}
              style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Factual Description</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{description.length} / 500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              required
              placeholder="Detail broken seals, soaked boxes, missing batch numbers, or clinic conditions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>

          {/* Photo Drop Zone / Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontWeight: '600', fontSize: '13px' }}>Photo Evidence (IPFS)</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max {DETECTION_CONFIG.MAX_REPORT_PHOTOS} photos</span>
            </div>
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius)',
                padding: '16px',
                textAlign: 'center',
                background: '#FAFAFA',
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={photoUploading || photos.length >= DETECTION_CONFIG.MAX_REPORT_PHOTOS}
                style={{ fontSize: '13px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                EXIF GPS coordinates are automatically stripped from image bytes for reporter privacy.
              </div>
              {photoUploading && <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--primary)' }}>Sniffing format & uploading to IPFS...</div>}
            </div>

            {photos.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                <strong>Attached CIDs:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {photos.map((cid, i) => (
                    <li key={i} style={{ fontFamily: 'monospace' }}>{cid.slice(0, 28)}...</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Location field: optional, off by default with consent note (Item 10) */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '12px', background: '#FAFAFA' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={locationConsent}
                onChange={(e) => setLocationConsent(e.target.checked)}
              />
              <strong>Attach approximate facility area (Optional with consent)</strong>
            </label>
            {locationConsent && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. PHC OPD Ward 12 (No personal addresses)"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
                />
              </div>
            )}
          </div>

          {/* Permanent Checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              required
              checked={acknowledgedPermanent}
              onChange={(e) => setAcknowledgedPermanent(e.target.checked)}
              style={{ marginTop: '3px' }}
            />
            <span style={{ fontSize: '13px', lineHeight: '1.4' }}>
              I confirm that this ground reality evidence is truthful. I understand that this submission is permanent and public on the blockchain.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !acknowledgedPermanent}
              className="btn-primary"
            >
              {loading ? 'Submitting to Arkiv...' : 'Submit Report (Immutable)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
