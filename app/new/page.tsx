'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import { createCivicRecordOnChain, generateReferenceCode } from '@/lib/arkiv';
import type { CivicRecordKind } from '@/lib/types';

export default function NewRecordPage() {
  const router = useRouter();
  const { getArkivClient, address, isConnected, isCorrectNetwork, switchNetwork, balanceGlm } = useWallet();

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
      // Check if wallet has gas tokens
      if (typeof window !== 'undefined' && (window as any).ethereum && balanceGlm === '0.00') {
        try {
          const provider = (window as any).ethereum;
          const balHex = await provider.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
          });
          if (balHex && BigInt(balHex) === 0n) {
            setErrorMessage('Your wallet has 0 $GLM on Tiramisu Testnet. Publishing an on-chain record requires gas tokens.');
            setLoading(false);
            return;
          }
        } catch {
          // continue
        }
      }

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
      const rawMsg = err?.message || err?.error?.message || String(err);
      if (rawMsg.includes('Execution error without revert data') || rawMsg.includes('insufficient funds') || rawMsg.includes('gas')) {
        setErrorMessage('Transaction failed: Insufficient gas or funds in wallet. Please claim test $GLM tokens from the faucet.');
      } else {
        setErrorMessage(rawMsg || 'Error publishing record to Arkiv.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '780px' }}>
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <Link href="/records" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          &larr; Back to Records
        </Link>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <div className="eyebrow">Genesis Manifest</div>
        <h1 style={{ fontSize: '30px', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
          Register Official Civic Record
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
          Publishes an official mutable entity (<code>civic_record</code>) alongside its companion immutable manifest (<code>dispatch_manifest</code>) on the Arkiv blockchain.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '14px 18px',
            borderRadius: 'var(--radius-card)',
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Submission Error</div>
          <div>{errorMessage}</div>
          {errorMessage.toLowerCase().includes('gas') || errorMessage.toLowerCase().includes('fund') || errorMessage.toLowerCase().includes('glm') ? (
            <div style={{ marginTop: '8px' }}>
              <a
                href="https://hub.arkiv.network/faucet"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Claim Free Test $GLM from Tiramisu Faucet &rarr;
              </a>
            </div>
          ) : null}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Read-only Reference Code Preview (Item 1) */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
            System Reference Code (Auto-Generated)
          </label>
          <input
            type="text"
            readOnly
            value={referenceCode}
            className="mono"
            style={{
              width: '100%',
              height: '40px',
              backgroundColor: 'var(--bg-surface-raised)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--accent)',
              fontWeight: 600,
              cursor: 'not-allowed',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
            Permanent reference format: KX-[KIND]-[DISTRICT]-[YEAR]-[RANDOM]
          </div>
        </div>

        {/* Kind and District Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Category / Kind
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CivicRecordKind)}
              style={{ width: '100%', height: '40px' }}
            >
              <option value="MEDICINE_BATCH">Medicine Batch</option>
              <option value="RELIEF_KIT">Relief Kit</option>
              <option value="ROAD_WORK">Road Work</option>
              <option value="WATER_WORK">Water Work</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              District
            </label>
            <input
              type="text"
              required
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Guntur"
              style={{ width: '100%', height: '40px' }}
            />
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
            Record Title / Batch Description
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. 500 Dengue Testing Kits (Lot AP-2026-04)"
            style={{ width: '100%', height: '40px' }}
          />
        </div>

        {/* Quantities */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Quantity Dispatched (Immutable)
            </label>
            <input
              type="number"
              min={1}
              required
              value={formData.quantity_dispatched}
              onChange={(e) =>
                setFormData({ ...formData, quantity_dispatched: parseInt(e.target.value, 10) || 0 })
              }
              style={{ width: '100%', height: '40px' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '4px' }}>
              Sealed in companion manifest
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Ward ID / Zone
            </label>
            <input
              type="text"
              value={formData.ward_id}
              onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
              placeholder="e.g. W-12"
              style={{ width: '100%', height: '40px' }}
            />
          </div>
        </div>

        {/* Origin and Destination */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Origin / Dispatching Facility
            </label>
            <input
              type="text"
              required
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              placeholder="e.g. State Warehouse, Vijayawada"
              style={{ width: '100%', height: '40px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
              Destination / Primary Health Center
            </label>
            <input
              type="text"
              required
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g. PHC Mangalagiri"
              style={{ width: '100%', height: '40px' }}
            />
          </div>
        </div>

        {/* Expiry Date */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
            Batch Expiry Date (Optional)
          </label>
          <input
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
            style={{ width: '100%', height: '40px' }}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px', color: 'var(--text-main)' }}>
            Initial Transit Notes
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="e.g. Temperature monitored cold chain transit..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Submit Button */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Link href="/records" className="btn btn-secondary btn-md">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-md"
            style={{ minWidth: '160px' }}
          >
            {loading ? 'Publishing to Arkiv...' : 'Publish On-Chain'}
          </button>
        </div>
      </form>
    </div>
  );
}
