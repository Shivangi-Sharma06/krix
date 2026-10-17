'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCivicRecords, fetchGroundReports, type EntityWithMetadata, RPC_URL } from '@/lib/arkiv';
import type { CivicRecordPayload } from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';

export default function DashboardPage() {
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

      for (const r of fetched) {
        // Query reports by canonical entityKey (Item 1)
        const reps = await fetchGroundReports(r.key);
        totalReps += reps.length;
        const maxSev = reps.reduce((max, rep) => Math.max(max, rep.payload.severity || 0), 0);

        const detection = detectCoverUp({
          currentRecord: r.payload,
          revisions: [],
          reports: reps.map((rp) => ({
            key: rp.key,
            blockNumber: rp.blockNumber,
            txHash: rp.txHash,
            creator: rp.creator,
            payload: rp.payload,
          })),
          custodianWallets: [r.owner],
        });

        if (detection.isCoverUp || detection.hasTampering) {
          coverUpCount++;
        }

        metaMap[r.key] = {
          reportCount: reps.length,
          maxSeverity: maxSev,
          isCoverUp: detection.isCoverUp || detection.hasTampering,
        };
      }

      setRecordMeta(metaMap);
      setStats({
        totalRecords: fetched.length,
        totalReports: totalReps,
        coverUpsDetected: coverUpCount,
      });
    } catch (err: any) {
      console.error('Failed to load dashboard records:', err);
      setErrorMessage(err?.message || 'Unable to load records from Tiramisu chain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = records
    .filter((r) => {
      const matchesSearch =
        r.payload.title.toLowerCase().includes(search.toLowerCase()) ||
        r.payload.reference_code.toLowerCase().includes(search.toLowerCase()) ||
        r.key.toLowerCase().includes(search.toLowerCase()) ||
        r.payload.district.toLowerCase().includes(search.toLowerCase());

      const matchesKind = filterKind === 'ALL' || r.payload.kind === filterKind;
      const matchesStatus = filterStatus === 'ALL' || r.payload.status === filterStatus;

      const meta = recordMeta[r.key];
      const matchesConflict = !filterConflictingOnly || (meta && meta.isCoverUp);

      return matchesSearch && matchesKind && matchesStatus && matchesConflict;
    })
    .sort((a, b) => {
      const metaA = recordMeta[a.key] || { reportCount: 0, maxSeverity: 0 };
      const metaB = recordMeta[b.key] || { reportCount: 0, maxSeverity: 0 };

      if (sortBy === 'REPORTS') return metaB.reportCount - metaA.reportCount;
      if (sortBy === 'SEVERITY') return metaB.maxSeverity - metaA.maxSeverity;
      return b.createdAt > a.createdAt ? 1 : -1;
    });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'ALL_GOOD_DELIVERED':
        return 'badge-green';
      case 'DAMAGED':
        return 'badge-red';
      case 'IN_TRANSIT':
        return 'badge-blue';
      case 'PARTIAL':
        return 'badge-amber';
      default:
        return 'badge-default';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          Civic Audit Dashboard
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
          Public tamper-evident verification for government civic projects and supply batches.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          <strong>Chain Connection Error:</strong> {errorMessage}
          <div style={{ marginTop: '8px' }}>
            <button onClick={loadData} className="btn-secondary" style={{ height: '30px', fontSize: '12px' }}>
              Retry RPC Query
            </button>
          </div>
        </div>
      )}

      {/* Row of 4 Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Official Records
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '4px' }}>{stats.totalRecords}</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Immutable Reports
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '4px' }}>{stats.totalReports}</div>
        </div>

        <div
          style={{
            background: stats.coverUpsDetected > 0 ? 'var(--danger-light)' : 'var(--bg-surface)',
            border: `1px solid ${stats.coverUpsDetected > 0 ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: stats.coverUpsDetected > 0 ? 'var(--danger)' : 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Cover-Ups Flagged
          </div>
          <div
            style={{
              fontSize: '26px',
              fontWeight: '700',
              marginTop: '4px',
              color: stats.coverUpsDetected > 0 ? 'var(--danger)' : 'var(--text-main)',
            }}
          >
            {stats.coverUpsDetected}
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live Chain Block
          </div>
          <div style={{ fontSize: '26px', fontWeight: '700', marginTop: '4px', fontFamily: 'monospace' }}>
            {liveBlock !== null ? `#${liveBlock.toString()}` : 'Connecting...'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search by ref code, title, district, entity key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            height: '40px',
            padding: '0 12px',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius)',
            minWidth: '260px',
            flex: '1',
          }}
        />

        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          style={{ height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
        >
          <option value="ALL">All Categories</option>
          <option value="MEDICINE_BATCH">Medicine Batch</option>
          <option value="RELIEF_KIT">Relief Kit</option>
          <option value="ROAD_WORK">Road Work</option>
          <option value="WATER_WORK">Water Work</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="CREATED">CREATED</option>
          <option value="IN_TRANSIT">IN_TRANSIT</option>
          <option value="DELIVERED">DELIVERED</option>
          <option value="DAMAGED">DAMAGED</option>
          <option value="PARTIAL">PARTIAL</option>
          <option value="ALL_GOOD_DELIVERED">ALL_GOOD_DELIVERED</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{ height: '40px', padding: '0 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', background: '#FFF' }}
        >
          <option value="DATE">Sort: Newest</option>
          <option value="REPORTS">Sort: Most Reports</option>
          <option value="SEVERITY">Sort: Severity</option>
        </select>

        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={filterConflictingOnly}
            onChange={(e) => setFilterConflictingOnly(e.target.checked)}
          />
          Has Conflicts
        </label>

        <button onClick={loadData} className="btn-secondary" style={{ height: '40px' }}>
          Refresh
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: '24px' }}>
          <div style={{ height: '24px', background: '#EAEAE6', borderRadius: '4px', marginBottom: '14px', width: '30%' }} />
          <div style={{ height: '40px', background: '#F2F2EE', borderRadius: '4px', marginBottom: '10px' }} />
          <div style={{ height: '40px', background: '#F2F2EE', borderRadius: '4px', marginBottom: '10px' }} />
          <div style={{ height: '40px', background: '#F2F2EE', borderRadius: '4px' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--radius)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>No records found</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '0 0 16px 0' }}>
            No records matched your search.
          </p>
          <Link href="/new" className="btn-primary">
            + Register New Record
          </Link>
        </div>
      ) : (
        /* Records Table linking to entityKey (Item 1) */
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: '#FAFAFA' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Reference Code
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Title
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Category
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Custodian
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Reports
                </th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Audit Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = recordMeta[r.key] || { reportCount: 0, isCoverUp: false };
                return (
                  <tr
                    key={r.key}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#FBFBFA')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>
                      <Link href={`/records/${r.key}`} style={{ fontWeight: '600', color: 'var(--primary)' }}>
                        {r.payload.reference_code || r.key.slice(0, 16) + '...'}
                      </Link>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/records/${r.key}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                        {r.payload.title}
                      </Link>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.payload.district} ({r.payload.ward_id})
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{r.payload.kind}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${getStatusBadgeClass(r.payload.status)}`}>
                        {r.payload.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px' }}>
                      {r.owner ? `${r.owner.slice(0, 6)}...${r.owner.slice(-4)}` : 'N/A'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {meta.reportCount > 0 ? (
                        <strong>{meta.reportCount} reports</strong>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {meta.isCoverUp ? (
                        <span className="badge badge-red" style={{ fontWeight: '700' }}>
                          FLAGGED
                        </span>
                      ) : (
                        <span className="badge badge-green">Clean</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
