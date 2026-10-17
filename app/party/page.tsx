'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import { fetchCivicRecords, type EntityWithMetadata } from '@/lib/arkiv';
import type { CivicRecordPayload } from '@/lib/types';
import { Truck, Package, ArrowRight, ShieldCheck, MapPin, AlertCircle, FileText } from 'lucide-react';

export default function PartyDashboardPage() {
  const { setUserRole } = useWallet();
  const [records, setRecords] = useState<EntityWithMetadata<CivicRecordPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');

  useEffect(() => {
    setUserRole('party');
  }, [setUserRole]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchCivicRecords();
        setRecords(data);
      } catch (err) {
        console.warn('Failed to load records for party portal:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const districts = ['ALL', ...Array.from(new Set(records.map((r) => r.payload.district).filter(Boolean)))];

  const filtered = records.filter((r) => {
    const p = r.payload;
    const matchesQuery =
      (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.destination || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.district || '').toLowerCase().includes(search.toLowerCase());
    const matchesDistrict = selectedDistrict === 'ALL' || p.district === selectedDistrict;
    return matchesQuery && matchesDistrict;
  });

  return (
    <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--bg-surface-raised)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              textTransform: 'uppercase',
              fontSize: '11px',
            }}
          >
            Intermediary &amp; Facility Portal
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>
            &bull; Self-declared operational claims &middot; Read-only ledger
          </span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <Link href="/citizen" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Citizen Portal
          </Link>
          <Link href="/authority" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Authority Portal &rarr;
          </Link>
        </div>
      </div>

      {/* Main Intro */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          Record Delivery Statements
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, maxWidth: '820px' }}>
          If you handle or receive civic deliveries (transport operators, truck drivers, regional distributors, or health clinic staff), record your observed counts, packaging conditions, and arrival checkpoints. Intermediary statements are optional, read-only claims that provide independent transparency on the claims ladder.
        </p>
      </div>

      {/* Role Notice Card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          marginBottom: '32px',
          backgroundColor: 'var(--bg-surface-raised)',
          borderLeft: '4px solid var(--accent)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
          Intermediary Statements are Claims, Not Proof
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Krix does not track goods custody or enforce a state machine. Statements are immutable, self-declared observations published directly to the blockchain to show where different parties agree or disagree.
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by promise code, clinic, medicine, or destination..."
            style={{ width: '100%', height: '40px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="party-district" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            District:
          </label>
          <select
            id="party-district"
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{ height: '40px', backgroundColor: 'var(--bg-surface-raised)', borderColor: 'var(--border-strong)' }}
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Promise Selection List */}
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          {loading ? 'Searching blockchain...' : `${filtered.length} Promises available for statements`}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton" style={{ height: '100px' }} />
            <div className="skeleton" style={{ height: '100px' }} />
            <div className="skeleton" style={{ height: '100px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '16px' }}>No public promises found matching your criteria.</p>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-faint)' }}>
              Try searching a different district or view all promises.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filtered.map((record) => {
              const p = record.payload;
              return (
                <div
                  key={record.key}
                  className="card"
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: '1 1 340px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-faint)' }}>
                        {p.reference_code || 'UNLABELED'}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        {p.status ? p.status.replace(/_/g, ' ') : 'CREATED'}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                      {p.title || 'Untitled Promise'}
                    </h2>

                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      <span>Destination: <strong style={{ color: 'var(--text-main)' }}>{p.destination || '—'}</strong></span>
                      <span>District: <strong>{p.district || '—'}</strong></span>
                      <span>Dispatched Quantity: <strong>{p.quantity_dispatched ?? '—'}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link
                      href={`/party/promise/${record.key}`}
                      className="btn btn-primary btn-md"
                      style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Truck size={15} />
                      <span>Record Statement &rarr;</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
