'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletContext';
import { fetchCivicRecords, fetchGroundReports, type EntityWithMetadata } from '@/lib/arkiv';
import type { CivicRecordPayload } from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';
import { PlusCircle, ShieldAlert, ArrowRight, Building, Truck, CheckCircle2, Lock } from 'lucide-react';

export default function AuthorityPage() {
  const { address, isConnected, connectMetaMask, setUserRole } = useWallet();
  const [records, setRecords] = useState<EntityWithMetadata<CivicRecordPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordComplaints, setRecordComplaints] = useState<Record<string, number>>({});
  const [contradictions, setContradictions] = useState<Record<string, boolean>>({});

  // Remember role in localStorage
  useEffect(() => {
    setUserRole('authority');
  }, [setUserRole]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchCivicRecords();
        setRecords(data);

        const complaintsMap: Record<string, number> = {};
        const contradictionsMap: Record<string, boolean> = {};

        for (const r of data) {
          const reps = await fetchGroundReports(r.key);
          complaintsMap[r.key] = reps.length;
          const detection = detectCoverUp({
            currentRecord: r.payload,
            manifest: null,
            reports: reps.map((rp) => ({
              key: rp.key,
              blockNumber: rp.createdAt,
              txHash: (rp as any).txHash || '',
              creator: rp.creator || '0x0',
              payload: rp.payload,
            })),
            revisions: [],
          });
          contradictionsMap[r.key] = detection.isCoverUp;
        }

        setRecordComplaints(complaintsMap);
        setContradictions(contradictionsMap);
      } catch (err) {
        console.warn('Failed to load records for authority view:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter records owned by connected address or all if not connected
  const myRecords = address
    ? records.filter((r) => r.owner && r.owner.toLowerCase() === address.toLowerCase())
    : [];

  return (
    <div className="app-container" style={{ maxWidth: '1040px', paddingTop: '32px', paddingBottom: '80px' }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-strong)', textTransform: 'uppercase', fontSize: '11px' }}>
            Authority Portal
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>&bull; Requires custodian wallet to sign actions</span>
        </div>
        <Link href="/citizen" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Not an official? Switch to Citizen Portal &rarr;
        </Link>
      </div>

      {/* Main Intro */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '36px' }}>
        <div style={{ maxWidth: '680px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 10px 0', color: 'var(--text-main)' }}>
            Authority Operations &amp; Custody
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            Publish new delivery promises, transfer cryptographic custody to transport contractors, review complaints filed from the field, and maintain an honest public record.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/new" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} />
            <span>Publish New Promise</span>
          </Link>
        </div>
      </div>

      {/* Wallet Status Banner */}
      {!isConnected && (
        <div
          role="region"
          aria-label="Wallet Connection Prompt"
          className="card"
          style={{
            padding: '24px',
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderColor: 'var(--border-strong)',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Connect Authority Wallet
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Connecting your wallet identifies which batches are currently in your custody and unlocks status updates and handovers.
            </div>
          </div>
          <button onClick={connectMetaMask} className="btn btn-primary btn-md">
            Connect Wallet
          </button>
        </div>
      )}

      {/* 4 Authority Duties Strip */}
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
            <Building size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            1. Seal Genesis Manifest
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Every promise locks quantity, origin, and destination in an immutable manifest.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <Truck size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            2. Transfer Custody
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Pass ownership to transport and receivers cryptographically with changeOwnership.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <ShieldAlert size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            3. Review Village Reports
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Inspect permanent citizen reports and field doctor observations before updating status.
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ color: 'var(--accent)', marginBottom: '10px' }}>
            <Lock size={22} />
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-main)' }}>
            4. Keep Records Honest
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            The time-travel engine automatically alerts auditors if official logs contradict ground reports.
          </div>
        </div>
      </div>

      {/* Authority Managed Records */}
      {isConnected && (
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
            Batches in Your Direct Custody ({myRecords.length})
          </div>
          {myRecords.length === 0 ? (
            <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: '0 0 12px 0' }}>No active batches are currently assigned to your connected address ({address?.slice(0, 8)}...{address?.slice(-6)}).</p>
              <Link href="/new" className="btn btn-secondary btn-md">
                + Register Your First Batch
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myRecords.map((record) => (
                <div key={record.key} className="card" style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <span className="mono" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{record.payload.reference_code}</span>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>{record.payload.title}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Destination: {record.payload.destination} &bull; Dispatched: {record.payload.quantity_dispatched}
                    </div>
                  </div>
                  <Link href={`/records/${record.key}`} className="btn btn-primary btn-md">
                    Manage Custody &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Public Promises Feed */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            All Active Public Records on Tiramisu ({records.length})
          </div>
          <Link href="/records" style={{ fontSize: '13px', color: 'var(--accent)' }}>
            Full Explorer Registry &rarr;
          </Link>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton" style={{ height: '90px' }} />
            <div className="skeleton" style={{ height: '90px' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {records.slice(0, 10).map((record) => {
              const p = record.payload;
              const hasContradiction = contradictions[record.key];
              const complaintCount = recordComplaints[record.key] || 0;

              return (
                <div
                  key={record.key}
                  className="card"
                  style={{
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    borderLeft: hasContradiction ? '3px solid var(--danger)' : '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{p.reference_code}</span>
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>{p.status}</span>
                      {hasContradiction && (
                        <span className="badge badge-danger" style={{ fontSize: '10px' }}>Contradiction Flagged</span>
                      )}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {p.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      District: {p.district} &bull; Dispatched: {p.quantity_dispatched} &bull; Citizen Reports: <strong>{complaintCount}</strong>
                    </div>
                  </div>

                  <Link href={`/records/${record.key}`} className="btn btn-secondary btn-md" style={{ fontSize: '13px' }}>
                    Inspect &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
