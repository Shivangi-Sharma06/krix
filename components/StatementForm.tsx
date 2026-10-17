'use client';

import React, { useState } from 'react';
import { useWallet } from '@/components/WalletContext';
import { submitStatementOnChain } from '@/lib/arkiv';
import { uploadPhotoToIpfs } from '@/lib/ipfs';
import { DETECTION_CONFIG } from '@/lib/constants';
import type { StatementPartyType, StatementCondition, StatementPayload } from '@/lib/types';
import type { Hex } from 'viem';
import { Camera, AlertCircle, ShieldAlert, CheckCircle, Info } from 'lucide-react';

interface StatementFormProps {
  promiseKey: Hex;
  referenceCode?: string;
  allowedVillages?: string[];
  onSuccess?: (txHash: string) => void;
  onCancel?: () => void;
}

export function StatementForm({
  promiseKey,
  referenceCode,
  allowedVillages = [],
  onSuccess,
  onCancel,
}: StatementFormProps) {
  const { getArkivClient, address, isConnected, isCorrectNetwork, switchNetwork } = useWallet();

  const [partyType, setPartyType] = useState<StatementPartyType>('TRANSPORT');
  const [locationChoice, setLocationChoice] = useState<string>('in transit');
  const [receivedCount, setReceivedCount] = useState<string>('');
  const [passedOnCount, setPassedOnCount] = useState<string>('');
  const [condition, setCondition] = useState<StatementCondition>('OK');
  const [note, setNote] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState<boolean>(false);
  const [acknowledgedPermanent, setAcknowledgedPermanent] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available location labels: villages from promise + "in transit" (strictly no free text)
  const locationOptions = ['in transit', ...allowedVillages.filter((v) => v !== 'in transit')];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (photos.length >= DETECTION_CONFIG.STATEMENT_MAX_PHOTOS) {
      setErrorMessage(`Maximum of ${DETECTION_CONFIG.STATEMENT_MAX_PHOTOS} photos allowed.`);
      return;
    }

    setPhotoUploading(true);
    setErrorMessage(null);
    try {
      const cid = await uploadPhotoToIpfs(file);
      setPhotos([...photos, cid]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload photo to IPFS.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isConnected) {
      setErrorMessage('Please connect your Web3 wallet to sign this statement.');
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!note.trim()) {
      setErrorMessage('Please provide a descriptive note regarding observed conditions or counts.');
      return;
    }

    if (note.length > DETECTION_CONFIG.STATEMENT_NOTE_MAX_LENGTH) {
      setErrorMessage(`Statement note cannot exceed ${DETECTION_CONFIG.STATEMENT_NOTE_MAX_LENGTH} characters.`);
      return;
    }

    if (!acknowledgedPermanent) {
      setErrorMessage('Please acknowledge the permanence notice before submitting.');
      return;
    }

    const payload: StatementPayload = {
      type: 'statement',
      record_entity_key: promiseKey,
      party_type: partyType,
      location: locationChoice,
      received_count: receivedCount !== '' ? parseInt(receivedCount, 10) : undefined,
      passedOn_count: passedOnCount !== '' ? parseInt(passedOnCount, 10) : undefined,
      condition,
      note: note.trim(),
      photo_cids: photos,
      event_date: eventDate.trim() || undefined,
    } as any;

    if (passedOnCount !== '') {
      payload.passed_on_count = parseInt(passedOnCount, 10);
    }

    setLoading(true);
    try {
      const client = getArkivClient();
      const res = await submitStatementOnChain(client, payload);
      if (onSuccess) {
        onSuccess(res.txHash);
      }
    } catch (err: any) {
      console.error('Error submitting statement:', err);
      setErrorMessage(err?.message || 'Failed to write statement to blockchain.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-card)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Promise reference */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
          Referenced Promise
        </label>
        <div
          className="mono"
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-btn)',
            fontSize: '13px',
            color: 'var(--text-main)',
          }}
        >
          {referenceCode || promiseKey}
        </div>
      </div>

      {/* Party Type (Self-declared) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="party-type-select" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
            Your Role (Self-Declared)
          </label>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase' }}>
            Never displayed as verified
          </span>
        </div>
        <select
          id="party-type-select"
          value={partyType}
          onChange={(e) => setPartyType(e.target.value as StatementPartyType)}
          style={{ width: '100%', height: '40px', backgroundColor: 'var(--bg-surface-raised)' }}
        >
          <option value="TRANSPORT">TRANSPORT (Driver, Logistics Operator)</option>
          <option value="DISTRIBUTOR">DISTRIBUTOR (Regional Warehouse, Hub Depot)</option>
          <option value="FACILITY_STAFF">FACILITY_STAFF (Clinic Staff, Warehouse Worker)</option>
          <option value="OTHER">OTHER (Contractor, Third Party)</option>
        </select>
      </div>

      {/* Location (Strictly chosen from promise villages or 'in transit') */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="location-choice-select" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
            Checkpoint Location Label
          </label>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            Must be chosen from promise list (no free-text)
          </span>
        </div>
        <select
          id="location-choice-select"
          value={locationChoice}
          onChange={(e) => setLocationChoice(e.target.value)}
          style={{ width: '100%', height: '40px', backgroundColor: 'var(--bg-surface-raised)' }}
        >
          {locationOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Received Count & Passed On Count */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <label htmlFor="stmt-received-count" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
            Count Received (Optional integer &ge; 0)
          </label>
          <input
            id="stmt-received-count"
            type="number"
            min="0"
            value={receivedCount}
            onChange={(e) => setReceivedCount(e.target.value)}
            placeholder="e.g. 480"
            style={{ width: '100%', height: '40px' }}
          />
        </div>

        <div>
          <label htmlFor="stmt-passed-count" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
            Count Passed On (Optional integer &ge; 0)
          </label>
          <input
            id="stmt-passed-count"
            type="number"
            min="0"
            value={passedOnCount}
            onChange={(e) => setPassedOnCount(e.target.value)}
            placeholder="e.g. 480"
            style={{ width: '100%', height: '40px' }}
          />
        </div>
      </div>

      {/* Condition */}
      <div>
        <label htmlFor="stmt-condition-select" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
          Observed Condition
        </label>
        <select
          id="stmt-condition-select"
          value={condition}
          onChange={(e) => setCondition(e.target.value as StatementCondition)}
          style={{ width: '100%', height: '40px', backgroundColor: 'var(--bg-surface-raised)' }}
        >
          <option value="OK">OK — Intact seals, undamaged packaging</option>
          <option value="DAMAGED">DAMAGED — Cracked vials, soaked cartons, broken seals</option>
          <option value="EXPIRED">EXPIRED — Near or past printed expiration date</option>
          <option value="SHORT">SHORT — Received fewer units than manifest stated</option>
          <option value="DELAYED">DELAYED — Delayed transit or arrival past promised schedule</option>
        </select>
      </div>

      {/* Note (Plain text, max 500 chars) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="stmt-note" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
            Statement Note
          </label>
          <span style={{ fontSize: '11px', color: note.length > 500 ? 'var(--danger)' : 'var(--text-faint)' }}>
            {note.length} / 500 chars
          </span>
        </div>
        <textarea
          id="stmt-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="State factual observations regarding delivery condition, cartons handled, or reasons for divergence..."
          style={{ width: '100%', resize: 'vertical' }}
        />
      </div>

      {/* Self-declared Event Date (Optional) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="stmt-event-date" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)' }}>
            Self-Declared Event Date (Optional)
          </label>
          <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
            Labelled as self-declared (actual block time is authoritative)
          </span>
        </div>
        <input
          id="stmt-event-date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          style={{ width: '100%', height: '40px' }}
        />
      </div>

      {/* Photo attachments (IPFS only, max 3, EXIF stripped) */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text-main)' }}>
          Photo Evidence (Max 3, IPFS only, EXIF stripped)
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            className="btn btn-secondary btn-md"
            style={{
              cursor: photoUploading || photos.length >= DETECTION_CONFIG.STATEMENT_MAX_PHOTOS ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Camera size={16} />
            <span>{photoUploading ? 'Uploading to IPFS...' : 'Attach Photo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={photoUploading || photos.length >= DETECTION_CONFIG.STATEMENT_MAX_PHOTOS}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
            {photos.length} / {DETECTION_CONFIG.STATEMENT_MAX_PHOTOS} attached
          </span>
        </div>

        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {photos.map((cid, i) => (
              <div
                key={i}
                className="mono"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'var(--bg-surface-raised)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>CID: {cid.slice(0, 12)}...</span>
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permanence Notice and Checkbox */}
      <div
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          backgroundColor: 'var(--bg-surface-raised)',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <input
            id="stmt-permanence-checkbox"
            type="checkbox"
            checked={acknowledgedPermanent}
            onChange={(e) => setAcknowledgedPermanent(e.target.checked)}
            style={{ marginTop: '3px' }}
          />
          <label htmlFor="stmt-permanence-checkbox" style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>
            <strong>Permanence Notice:</strong> I understand that this statement is an immutable on-chain claim. It cannot be modified, deleted, or hidden once signed. My wallet address and self-declared role will remain permanently on public record.
          </label>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-md">
            Cancel
          </button>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary btn-md">
          {loading ? 'Submitting Statement to Arkiv...' : 'Record Statement on Chain'}
        </button>
      </div>
    </form>
  );
}
