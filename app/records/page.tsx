'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCivicRecords, fetchGroundReports, type EntityWithMetadata, RPC_URL } from '@/lib/arkiv';
import type { CivicRecordPayload } from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';

export default function RecordsDashboardPage() {
  const [records, setRecords] = useState<EntityWithMetadata<CivicRecordPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterConflictingOnly, setFilterConflictingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE' | 'REPORTS' | 'SEVERITY'>('DATE');

  const [liveBlock, setLiveBlock] = useState<bigint | null>(null);
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalReports: 0,
    coverUpsDetected: 0,
  });

  const [recordMeta, setRecordMeta] = useState<
    Record<string, { reportCount: number; maxSeverity: number; isCoverUp: boolean }>
  >({});

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      try {
        const blkRes = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        });
        const blkData = await blkRes.json();
        if (blkData.result) setLiveBlock(BigInt(blkData.result));
      } catch (e) {
        console.warn('Block query error:', e);
      }

      const fetched = await fetchCivicRecords();
      setRecords(fetched);

      let totalReps = 0;
      let coverUpCount = 0;
      const metaMap: Record<string, { reportCount: number; maxSeverity: number; isCoverUp: boolean }> = {};

      await Promise.allSettled(
        fetched.map(async (r) => {
          try {
            const reps = await fetchGroundReports(r.key);
            totalReps += reps.length;
            const maxSev = reps.reduce((max, rep) => Math.max(max, rep.payload.severity || 0), 0);

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

            if (detection.isCoverUp) coverUpCount++;

            metaMap[r.key] = {
              reportCount: reps.length,
              maxSeverity: maxSev,
              isCoverUp: detection.isCoverUp,
            };
          } catch {
            metaMap[r.key] = {
              reportCount: 0,
              maxSeverity: 0,
              isCoverUp: false,
            };
          }
        })
      );

      setRecordMeta(metaMap);
      setStats({
        totalRecords: fetched.length,
        totalReports: totalReps,
        coverUpsDetected: coverUpCount,
      });
    } catch (err: any) {
      console.error('Failed to load civic records:', err);
      setErrorMessage(
        err?.message ||
          'Failed to load records from Tiramisu RPC. Please ensure RPC is accessible.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = records
    .filter((r) => {
      const p = r.payload;
      const refCode = p.reference_code || '';
      const title = p.title || '';
      const dist = p.district || '';
      const entityKey = r.key || '';

      const query = search.toLowerCase();
      const matchesSearch =
        refCode.toLowerCase().includes(query) ||
        title.toLowerCase().includes(query) ||
        dist.toLowerCase().includes(query) ||
        entityKey.toLowerCase().includes(query);

      const matchesKind = filterKind === 'ALL' || p.kind === filterKind;
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      const matchesConflict = !filterConflictingOnly || (recordMeta[r.key]?.isCoverUp ?? false);

      return matchesSearch && matchesKind && matchesStatus && matchesConflict;
    })
    .sort((a, b) => {
      if (sortBy === 'REPORTS') {
        return (recordMeta[b.key]?.reportCount || 0) - (recordMeta[a.key]?.reportCount || 0);
      }
      if (sortBy === 'SEVERITY') {
        return (recordMeta[b.key]?.maxSeverity || 0) - (recordMeta[a.key]?.maxSeverity || 0);
      }
      return Number(b.createdAt - a.createdAt);
    });

  return (
    <div className="app-container">
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div>
          <div className="eyebrow">On-Chain Registry</div>
          <h1 style={{ fontSize: '32px', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            Civic Records
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
            Verifiable supply batches, custody handovers, and immutable ground reality reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={loadData} disabled={loading} className="btn btn-secondary btn-md">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link href="/new" className="btn btn-primary btn-md">
            + New Record
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-card)',
            padding: '16px 20px',
            marginBottom: '24px',
            color: 'var(--danger)',
            fontSize: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button onClick={loadData} className="btn btn-secondary btn-md" style={{ height: '30px' }}>
            Retry
          </button>
        </div>
      )}

      {/* 4 Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="card">
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Registered Records
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-main)' }}>
            {loading ? '—' : stats.totalRecords}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Permanent on Tiramisu L3
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Ground Reports Filed
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-main)' }}>
            {loading ? '—' : stats.totalReports}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Readonly &amp; uncensorable
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Contradictions Flagged
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: stats.coverUpsDetected > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {loading ? '—' : stats.coverUpsDetected}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Discrepancies detected
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', marginBottom: '8px' }}>
            Current Block
          </div>
          <div className="mono" style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-main)' }}>
            {liveBlock ? `#${liveBlock.toString()}` : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tiramisu Testnet (7738577)
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          marginBottom: '24px',
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search reference code, title, district, entity key..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              style={{ height: '36px', minWidth: '140px' }}
            >
              <option value="ALL">All Categories</option>
              <option value="MEDICINE_BATCH">Medicine Batches</option>
              <option value="RELIEF_KIT">Relief Kits</option>
              <option value="ROAD_WORK">Road Works</option>
              <option value="WATER_WORK">Water Works</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ height: '36px', minWidth: '130px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DAMAGED">Damaged</option>
              <option value="PARTIAL">Partial</option>
              <option value="ALL_GOOD_DELIVERED">All Good Delivered</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ height: '36px' }}
            >
              <option value="DATE">Sort: Newest</option>
              <option value="REPORTS">Sort: Most Reports</option>
              <option value="SEVERITY">Sort: Severity</option>
            </select>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: filterConflictingOnly ? 'var(--danger)' : 'var(--text-muted)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={filterConflictingOnly}
                onChange={(e) => setFilterConflictingOnly(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Contradictions only
            </label>
          </div>
        </div>
      </div>

      {/* Records Table / Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: '72px', width: '100%' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '8px' }}>
            No records found
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px' }}>
            {search || filterKind !== 'ALL' || filterStatus !== 'ALL' || filterConflictingOnly
              ? 'No civic records match the selected filters. Try clearing filters or search term.'
              : 'No records have been seeded or created yet. You can create the first record now.'}
          </p>
          <Link href="/new" className="btn btn-primary btn-md">
            + Register First Record
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((record) => {
            const p = record.payload;
            const meta = recordMeta[record.key] || { reportCount: 0, maxSeverity: 0, isCoverUp: false };

            let statusBadgeClass = 'badge-default';
            if (p.status === 'ALL_GOOD_DELIVERED' || p.status === 'DELIVERED') {
              statusBadgeClass = 'badge-success';
            } else if (p.status === 'DAMAGED') {
              statusBadgeClass = 'badge-danger';
            } else if (p.status === 'IN_TRANSIT' || p.status === 'PARTIAL') {
              statusBadgeClass = 'badge-warning';
            }

            return (
              <Link
                key={record.key}
                href={`/records/${record.key}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 22px',
                    borderLeft: meta.isCoverUp ? '3px solid var(--danger)' : '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {p.reference_code || 'UNLABELED'}
                      </span>

                      <span className={`badge ${statusBadgeClass}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>

                      {meta.isCoverUp && (
                        <span className="badge badge-danger">
                          CONTRADICTION FOUND
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {p.title || 'Untitled Record'}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span>District: <strong>{p.district || '—'}</strong></span>
                      <span>Ward: <strong>{p.ward_id || '—'}</strong></span>
                      <span>Dispatched: <strong>{p.quantity_dispatched}</strong></span>
                      <span>Received: <strong>{p.quantity_received}</strong></span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                        Reports
                      </div>
                      <div style={{ fontWeight: 600, color: meta.reportCount > 0 ? 'var(--text-main)' : 'var(--text-faint)' }}>
                        {meta.reportCount} {meta.reportCount === 1 ? 'report' : 'reports'}
                        {meta.maxSeverity > 0 && ` (${meta.maxSeverity}/10)`}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                        Entity Key
                      </div>
                      <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {record.key.slice(0, 8)}...{record.key.slice(-6)}
                      </div>
                    </div>

                    <span style={{ color: 'var(--accent)', fontSize: '18px' }}>&rarr;</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
