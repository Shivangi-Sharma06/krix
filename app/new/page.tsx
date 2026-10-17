'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/components/WalletContext';
import { createCivicRecordOnChain } from '@/lib/arkiv';
import type { CivicRecordPayload, CivicRecordKind } from '@/lib/types';

export default function NewRecordPage() {
  const router = useRouter();
  const { getArkivClient, address } = useWallet();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CivicRecordPayload>({
    type: 'civic_record',
    record_id: `IND-AP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    kind: 'MEDICINE_BATCH',
    title: '',
    quantity_dispatched: 100,
    quantity_received: 0,
    status: 'CREATED',
    origin: '',
    destination: '',
    expiry_date: '',
    district: '',
    ward_id: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.record_id) {
      alert('Please fill in required fields (Record ID, Title).');
      return;
    }

    setLoading(true);
    try {
      const client = getArkivClient();
      const res = await createCivicRecordOnChain(client, formData);
      alert(`Civic Record created on chain!\nEntity Key: ${res.entityKey}\nTx: ${res.txHash}`);
      router.push(`/records/${formData.record_id}`);
    } catch (err: any) {
      alert('Error creating civic record: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Create New Civic Record</h1>
      <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>
        Registers an official, mutable on-chain entity tracked on Arkiv Tiramisu testnet.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          border: '1px solid #ccc',
          padding: '20px',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontSize: '13px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>
            Record ID (Permanent Reference):
          </label>
          <input
            type="text"
            required
            value={formData.record_id}
            onChange={(e) => setFormData({ ...formData, record_id: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #999', fontFamily: 'monospace' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Category / Kind:</label>
          <select
            value={formData.kind}
            onChange={(e) => setFormData({ ...formData, kind: e.target.value as CivicRecordKind })}
            style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
          >
            <option value="MEDICINE_BATCH">Medicine Batch</option>
            <option value="RELIEF_KIT">Relief Kit</option>
            <option value="ROAD_WORK">Road Work</option>
            <option value="WATER_WORK">Water Work</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Title / Description:</label>
          <input
            type="text"
            required
            placeholder="e.g. 500 Dengue Testing Kits"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Quantity Dispatched:</label>
            <input
              type="number"
              min="1"
              required
              value={formData.quantity_dispatched}
              onChange={(e) => setFormData({ ...formData, quantity_dispatched: parseInt(e.target.value) || 0 })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Expiry Date (Optional):</label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Origin:</label>
            <input
              type="text"
              placeholder="e.g. Central Warehouse, Vijayawada"
              value={formData.origin}
              onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Destination:</label>
            <input
              type="text"
              placeholder="e.g. PHC Mangalagiri"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>District:</label>
            <input
              type="text"
              placeholder="e.g. Guntur"
              value={formData.district}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Ward ID:</label>
            <input
              type="text"
              placeholder="e.g. W-12"
              value={formData.ward_id}
              onChange={(e) => setFormData({ ...formData, ward_id: e.target.value })}
              style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Initial Notes:</label>
          <textarea
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Dispatched from cold chain storage..."
            style={{ width: '100%', padding: '6px', border: '1px solid #999' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '8px',
          }}
        >
          {loading ? 'Submitting to Arkiv Network...' : 'Create Civic Record on Arkiv'}
        </button>
      </form>
    </div>
  );
}
