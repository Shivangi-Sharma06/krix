'use client';

import React, { useState } from 'react';
import { useWallet } from './WalletContext';
import { submitGroundReportOnChain } from '@/lib/arkiv';
import { uploadPhotoToIpfs } from '@/lib/ipfs';
import { DETECTION_CONFIG } from '@/lib/constants';
import type { GroundReportVerdict, ReporterRole } from '@/lib/types';
import type { Hex } from 'viem';

interface SubmitReportModalProps {
  recordEntityKey: Hex;
  referenceCode: string;
  recordCustodianAddress?: string;
  custodianWallets?: string[];
  onClose: () => void;
  onSuccess?: () => void;
  onReportSubmitted?: (txHash?: string) => void;
}

export function SubmitReportModal({
  recordEntityKey,
  referenceCode,
  recordCustodianAddress,
  custodianWallets,
  onClose,
  onSuccess,
  onReportSubmitted,
}: SubmitReportModalProps) {
  const { getArkivClient, address, isConnected, isCorrectNetwork, switchNetwork, userRole } = useWallet();

  const [verdict, setVerdict] = useState<GroundReportVerdict>('DAMAGED');
  const [severity, setSeverity] = useState<number>(8);
  const [countReceived, setCountReceived] = useState<number>(300);
  const [description, setDescription] = useState<string>('');
  const [reporterRole, setReporterRole] = useState<ReporterRole>('DOCTOR');
  const [photos, setPhotos] = useState<string[]>([]);
  const [locationConsent, setLocationConsent] = useState<boolean>(false);
  const [locationText, setLocationText] = useState<string>('');
  const [acknowledgedPermanent, setAcknowledgedPermanent] = useState<boolean>(false);

  const [photoUploading, setPhotoUploading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if reporter is an official custodian (Item 5)
  const isReporterCustodian =
    address &&
    ((recordCustodianAddress && address.toLowerCase() === recordCustodianAddress.toLowerCase()) ||
      (custodianWallets && custodianWallets.some((c) => c.toLowerCase() === address.toLowerCase())));

  // Check daily limit in localStorage (Item 5)
  const checkDailyLimit = (): boolean => {
    if (!address) return true;
    const today = new Date().toISOString().slice(0, 10);
    const key = `krix_reports_${address.toLowerCase()}_${recordEntityKey}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    return count < DETECTION_CONFIG.CLIENT_DAILY_REPORT_LIMIT;
  };

  const incrementDailyCount = () => {
    if (!address) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `krix_reports_${address.toLowerCase()}_${recordEntityKey}_${today}`;
    const count = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (count + 1).toString());
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (photos.length >= DETECTION_CONFIG.MAX_REPORT_PHOTOS) {
      setErrorMessage(`Maximum of ${DETECTION_CONFIG.MAX_REPORT_PHOTOS} photos allowed per report.`);
      return;
    }

    setPhotoUploading(true);
    setErrorMessage(null);
    try {
      const cid = await uploadPhotoToIpfs(file);
      setPhotos([...photos, cid]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload image to IPFS.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (userRole === 'authority') {
      setErrorMessage('Authority accounts cannot submit ground reports. Only citizens and intermediaries may report field observations.');
      return;
    }

    if (!isConnected) {
      setErrorMessage('Please connect your Web3 wallet.');
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!checkDailyLimit()) {
      setErrorMessage(`Daily rate limit exceeded: Maximum ${DETECTION_CONFIG.CLIENT_DAILY_REPORT_LIMIT} reports per day per record.`);
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a factual description of observed conditions.');
      return;
    }

    if (!acknowledgedPermanent) {
      setErrorMessage('Please check the confirmation acknowledging this record is permanent.');
      return;
    }

    setLoading(true);
    try {
      const client = getArkivClient();
      const res = await submitGroundReportOnChain(client, {
        type: 'ground_report',
        record_entity_key: recordEntityKey,
        severity,
        verdict,
        count_received: countReceived,
        description: description.trim(),
        photo_cids: photos,
        reporter_role: reporterRole,
        location: locationConsent && locationText.trim() ? locationText.trim() : null,
        is_custodian_submission: !!isReporterCustodian,
      });

      incrementDailyCount();
      if (onSuccess) onSuccess();
      if (onReportSubmitted) onReportSubmitted(res?.txHash);
    } catch (err: any) {
      console.error('Ground report error:', err);
      setErrorMessage(err?.message || 'Transaction failed. Please check funds and network.');
    } finally {
      setLoading(false);
    }
  };

  if (userRole === 'authority') {
    return (
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
        <div
          className="card"
          style={{
            maxWidth: '480px',
            width: '100%',
            padding: '32px',
            textAlign: 'center',
            boxShadow: 'none',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚖️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
            Authority Role Restriction
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '24px' }}>
            Authority accounts cannot submit ground reality citizen reports. Authorities may only issue promises, update official statuses, and reply to citizen reports.
          </p>
          <button onClick={onClose} className="btn btn-secondary btn-md" style={{ width: '100%' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
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
      <div
        className="card"
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '28px',
          boxShadow: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '4px' }}>Uncensorable Reporting</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 2px 0', color: 'var(--text-main)' }}>
              Submit Ground Reality Report
            </h2>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Ref: <strong style={{ color: 'var(--accent)' }}>{referenceCode}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="btn btn-secondary btn-md"
            style={{ height: '32px', width: '32px', padding: 0, borderRadius: '50%' }}
          >
            &times;
          </button>
        </div>

        {/* Required Disclosure Notice */}
        <div
          role="alert"
          style={{
            border: '1px solid var(--danger-border)',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-btn)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <strong>This report will be permanent and public.</strong> No one can edit or delete it once submitted to the Arkiv blockchain.
        </div>

        {/* Reporter Custodian Notice (Item 5) */}
        {isReporterCustodian && (
          <div
            role="alert"
            style={{
              border: '1px solid var(--warning-border)',
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-btn)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <strong>Custodian Wallet Detected:</strong> Your wallet is identified as an official custodian of this record. Your submission will be marked &ldquo;submitted by custodian&rdquo; and excluded from independent auditor counts.
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            style={{
              border: '1px solid var(--danger-border)',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-btn)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '14px' }}>
          {/* Reporter Role (Self-Declared Badge, Item 5) */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Your Role in Audit (Self-Declared)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['DOCTOR', 'INSPECTOR', 'CITIZEN'] as ReporterRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setReporterRole(role)}
                  className={reporterRole === role ? 'btn btn-primary btn-md' : 'btn btn-secondary btn-md'}
                  style={{ flex: 1, fontSize: '12px', height: '36px' }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Verdict and Severity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
                Field Verdict
              </label>
              <select
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as GroundReportVerdict)}
                style={{ width: '100%', height: '38px' }}
              >
                <option value="DAMAGED">Damaged Goods / Broken Seals</option>
                <option value="EXPIRED">Expired Medicines</option>
                <option value="SHORT_QUANTITY">Short Quantity Received</option>
                <option value="NOT_RECEIVED">Not Received at Clinic</option>
                <option value="ALL_GOOD">All Good / Compliant</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Severity Rating</label>
                <span className="mono" style={{ fontWeight: 600, color: severity >= 7 ? 'var(--danger)' : 'var(--accent)' }}>
                  {severity} / 10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                style={{ width: '100%', height: '38px', accentColor: 'var(--accent)' }}
              />
            </div>
          </div>

          {/* Observed Count */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Physical Count Observed (Usable Units)
            </label>
            <input
              type="number"
              min={0}
              required
              value={countReceived}
              onChange={(e) => setCountReceived(parseInt(e.target.value, 10) || 0)}
              style={{ width: '100%', height: '38px' }}
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Factual Description</label>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{description.length} / 500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              required
              placeholder="Detail broken seals, soaked boxes, missing batch numbers, or clinic conditions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Photo Drop Zone / Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>Photo Evidence (IPFS)</label>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Max {DETECTION_CONFIG.MAX_REPORT_PHOTOS} photos</span>
            </div>
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-card)',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-raised)',
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={photoUploading || photos.length >= DETECTION_CONFIG.MAX_REPORT_PHOTOS}
                style={{ fontSize: '13px' }}
              />
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' }}>
                EXIF GPS coordinates are automatically stripped from image bytes for reporter privacy.
              </div>
              {photoUploading && (
                <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--accent)' }}>
                  Sniffing format &amp; uploading to IPFS...
                </div>
              )}
            </div>

            {photos.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                <strong style={{ color: 'var(--text-main)' }}>Attached CIDs:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, color: 'var(--text-muted)' }}>
                  {photos.map((cid, i) => (
                    <li key={i} className="mono">{cid.slice(0, 28)}...</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Location field: optional, off by default with consent note */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '12px', backgroundColor: 'var(--bg-surface-raised)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
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
                  style={{ width: '100%', height: '36px' }}
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
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-muted)' }}>
              I confirm that this ground reality evidence is truthful. I understand that this submission is permanent and public on the blockchain.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-md">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !acknowledgedPermanent}
              className="btn btn-primary btn-md"
              style={{ minWidth: '180px' }}
            >
              {loading ? 'Submitting to Arkiv...' : 'Submit Report (Immutable)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
