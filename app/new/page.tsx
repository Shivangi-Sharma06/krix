'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import { createCivicRecordOnChain, generateReferenceCode } from '@/lib/arkiv';
import type { CivicRecordKind } from '@/lib/types';

export default function NewRecordPage() {
  const router = useRouter();
  const { getArkivClient, address, isConnected, isCorrectNetwork, switchNetwork } = useWallet();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [kind, setKind] = useState<CivicRecordKind>('MEDICINE_BATCH');
  const [district, setDistrict] = useState('Guntur');
  const [referenceCode, setReferenceCode] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    quantity_dispatched: 500,
    quantity_received: 0,
    status: 'CREATED' as const,
    origin: 'State Warehouse, Vijayawada',
    destination: 'PHC Mangalagiri',
    expiry_date: '2027-03-31',
    ward_id: 'W-12',
    notes: 'Dispatched from cold chain storage',
  });

  // Automatically generate reference code preview (Item 1)
  useEffect(() => {
    setReferenceCode(generateReferenceCode(kind, district));
  }, [kind, district]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isConnected) {
      setErrorMessage('Please connect your wallet first.');
      return;
    }

    if (!isCorrectNetwork) {
      await switchNetwork();
      return;
    }

    if (!formData.title.trim()) {
      setErrorMessage('Please provide a title / specification.');
      return;
    }

    setLoading(true);
    try {
      const client = getArkivClient();
      const res = await createCivicRecordOnChain(client, {
        reference_code: referenceCode,
        kind,
        title: formData.title.trim(),
        quantity_dispatched: formData.quantity_dispatched,
        quantity_received: 0,
        status: 'CREATED',
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        expiry_date: formData.expiry_date || undefined,
        district: district.trim(),
        ward_id: formData.ward_id.trim(),
        notes: formData.notes.trim(),
        type: 'civic_record',
      });

      // Redirect to the canonical entityKey URL (Item 1)
      router.push(`/records/${res.entityKey}`);
    } catch (err: any) {
      console.error('Failed to create civic record:', err);
      setErrorMessage(err?.message || 'Error publishing record to Arkiv.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <Link href="/" style={{ color: 'var(--primary)', fontWeight: '500' }}>
          ← Back to Records
        </Link>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '600', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Register Official Civic Record
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
          Publishes an official mutable entity (<code>civic_record</code>) and its companion immutable manifest (<code>dispatch_manifest</code>) on the Arkiv blockchain.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          <strong>Submission Error:</strong> {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          fontSize: '14px',
        }}
      >
        {/* Read-only Reference Code Preview (Item 1) */}
        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
            System Reference Code (Auto-Generated)
          </label>
          <input
            type="text"
            readOnly
            value={referenceCode}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              background: '#F7F7F5',
              fontFamily: 'monospace',
              color: 'var(--text-main)',
              fontWeight: '600',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Permanent human-readable code. The record's canonical ID will be its on-chain Arkiv entity key.
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
            Batch / Project Category
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CivicRecordKind)}
            style={{ width: '100%', height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
          >
            <option value="MEDICINE_BATCH">Medicine Batch</option>
            <option value="RELIEF_KIT">Disaster Relief Kit</option>
            <option value="ROAD_WORK">Ward Road Work</option>
            <option value="WATER_WORK">Water Supply Work</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
            Title / Specification
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 500 Dengue Testing Kits"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Quantity Dispatched (Immutable)
            </label>
            <input
              type="number"
              min="1"
              required
              value={formData.quantity_dispatched}
              onChange={(e) => setFormData({ ...formData, quantity_dispatched: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Batch Expiry Date (Optional)
            </label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Origin Warehouse (Immutable)
            </label>
            <input
              type="text"
              required
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Destination Facility (Immutable)
            </label>
            <input
              type="text"
              required
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              District
            </label>
            <input
              type="text"
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
              Ward / Locality ID
            </label>
            <input
              type="text"
              required
              value={formData.ward_id}
              onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
              style={{ width: '100%', height: '40px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
            Initial Dispatch Notes
          </label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            style={{ width: '100%', padding: '10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <Link href="/" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Publishing to Arkiv...' : 'Create Civic Record & Manifest'}
          </button>
        </div>
      </form>
    </div>
  );
}
