'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import { fetchCivicRecords, fetchGroundReports, type EntityWithMetadata } from '@/lib/arkiv';
import type { CivicRecordPayload, GroundReportPayload } from '@/lib/types';
import { SubmitReportModal } from '@/components/SubmitReportModal';
import { MapPin, Camera, AlertTriangle, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck } from 'lucide-react';

export default function CitizenPage() {
  const { setUserRole } = useWallet();
  const [records, setRecords] = useState<EntityWithMetadata<CivicRecordPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedRecordForReport, setSelectedRecordForReport] = useState<EntityWithMetadata<CivicRecordPayload> | null>(null);
  const [reportedTx, setReportedTx] = useState<string | null>(null);
  const [lastReportedKey, setLastReportedKey] = useState<string | null>(null);

  // Set convenience role in localStorage
  useEffect(() => {
    setUserRole('citizen');
  }, [setUserRole]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchCivicRecords();
        setRecords(data);
      } catch (err) {
        console.warn('Failed to load records for citizen view:', err);
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
          <span className="badge" style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', textTransform: 'uppercase', fontSize: '11px' }}>
            Citizen Portal
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>&bull; No wallet or account required to inspect</span>
        </div>
        <Link href="/authority" style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none' }}>
          Are you an authority? Switch to Authority Portal &rarr;
        </Link>
      </div>

      {/* Main Intro */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          Public Promises for Your Community
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, maxWidth: '780px' }}>
          Find the public deliveries and works promised to your village, ward, or primary health center. Tell whether the supplies arrived, file a complaint with photos if they are damaged or missing, and check the authority&apos;s response.
        </p>
      </div>

      {/* 4 Citizen Actions Explainer Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <MapPin size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            1. Find your village
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Filter by district or clinic name to find what was dispatched.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <Camera size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            2. File photo proof
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Submit an unalterable ground report with photos of damaged vials or unfinished roads.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <MessageSquare size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            3. See authority reply
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Read the official custodian&apos;s notes and verified handover chain.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <CheckCircle2 size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            4. Confirm resolution
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Post a follow-up report confirming whether the issue was actually fixed.
          </div>
        </div>
      </div>

      {reportedTx && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-card)',
            marginBottom: '28px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong>Report successfully recorded on-chain:</strong>{' '}
            <a
              href={`https://tiramisu.explorer.arkiv.network/tx/${reportedTx}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'underline', marginLeft: '6px' }}
            >
              View transaction on Tiramisu explorer &rarr;
            </a>
          </div>

          {lastReportedKey && (
            <Link
              href={`/citizen/promise/${lastReportedKey}`}
              className="btn btn-primary btn-md"
              style={{ fontSize: '13px' }}
            >
              See Claims Ladder &rarr;
            </Link>
          )}
        </div>
      )}

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
            placeholder="Search by clinic, medicine, village, or code..."
            style={{ width: '100%', height: '40px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="citizen-district" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            District:
          </label>
          <select
            id="citizen-district"
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

      {/* Promises List */}
      <div>
        <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          {loading ? 'Searching blockchain...' : `${filtered.length} Promises found`}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton" style={{ height: '110px' }} />
            <div className="skeleton" style={{ height: '110px' }} />
            <div className="skeleton" style={{ height: '110px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '16px' }}>No public promises found matching your criteria.</p>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-faint)' }}>
              Try searching a different district or view all records.
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
                      {p.title || 'Untitled Delivery'}
                    </h2>

                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      <span>Destination: <strong style={{ color: 'var(--text-main)' }}>{p.destination || '—'}</strong></span>
                      <span>District: <strong>{p.district || '—'}</strong></span>
                      <span>Dispatched Count: <strong>{p.quantity_dispatched ?? '—'}</strong></span>
                      <span>Confirmed Received: <strong>{p.quantity_received ?? 0}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => setSelectedRecordForReport(record)}
                      className="btn btn-secondary btn-md"
                      style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={15} />
                      <span>Report Reality</span>
                    </button>
                    <Link
                      href={`/citizen/promise/${record.key}`}
                      className="btn btn-primary btn-md"
                      style={{ fontSize: '13px' }}
                    >
                      Inspect Ladder &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ground Reality Report Modal */}
      {selectedRecordForReport && (
        <SubmitReportModal
          recordEntityKey={selectedRecordForReport.key}
          referenceCode={selectedRecordForReport.payload.reference_code}
          recordCustodianAddress={selectedRecordForReport.owner}
          onClose={() => setSelectedRecordForReport(null)}
          onReportSubmitted={(txHash) => {
            setReportedTx(txHash || null);
            setLastReportedKey(selectedRecordForReport.key);
            setSelectedRecordForReport(null);
          }}
        />
      )}
    </div>
  );
}
