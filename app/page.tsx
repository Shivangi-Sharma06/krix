'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCivicRecords, fetchGroundReports, type EntityWithMetadata } from '@/lib/arkiv';
import type { CivicRecordPayload, CivicRecordKind, CivicRecordStatus } from '@/lib/types';
import { detectCoverUp } from '@/lib/detect';

export default function DashboardPage() {
  const [records, setRecords] = useState<EntityWithMetadata<CivicRecordPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterConflictingOnly, setFilterConflictingOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'DATE' | 'REPORTS' | 'SEVERITY'>('DATE');

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalReports: 0,
    coverUpsDetected: 0,
  });

  // Supplementary data per record: report count and coverup flag
  const [recordMeta, setRecordMeta] = useState<
    Record<string, { reportCount: number; maxSeverity: number; isCoverUp: boolean }>
  >({});

  const loadData = async () => {
    setLoading(true);
    try {
      const fetched = await fetchCivicRecords();
      setRecords(fetched);

      // Analyze each record for conflicting reports & stats
      let totalReps = 0;
      let coverUpCount = 0;
      const metaMap: Record<string, { reportCount: number; maxSeverity: number; isCoverUp: boolean }> = {};

      for (const r of fetched) {
        const reps = await fetchGroundReports(r.payload.record_id);
        totalReps += reps.length;
        const maxSev = reps.reduce((max, rep) => Math.max(max, rep.payload.severity || 0), 0);

        // Run cover up test
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
        });

        if (detection.isCoverUp) {
          coverUpCount++;
        }

        metaMap[r.payload.record_id] = {
          reportCount: reps.length,
          maxSeverity: maxSev,
          isCoverUp: detection.isCoverUp,
        };
      }

      setRecordMeta(metaMap);
      setStats({
        totalRecords: fetched.length,
        totalReports: totalReps,
        coverUpsDetected: coverUpCount,
      });
    } catch (err) {
      console.error('Failed to load dashboard records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter & sort logic (Client-side per sdk.txt rule)
  const filtered = records
    .filter((r) => {
      const matchesSearch =
        r.payload.title.toLowerCase().includes(search.toLowerCase()) ||
        r.payload.record_id.toLowerCase().includes(search.toLowerCase()) ||
        r.payload.district.toLowerCase().includes(search.toLowerCase());

      const matchesKind = filterKind === 'ALL' || r.payload.kind === filterKind;
      const matchesStatus = filterStatus === 'ALL' || r.payload.status === filterStatus;

      const meta = recordMeta[r.payload.record_id];
      const matchesConflict = !filterConflictingOnly || (meta && meta.isCoverUp);

      return matchesSearch && matchesKind && matchesStatus && matchesConflict;
    })
    .sort((a, b) => {
      const metaA = recordMeta[a.payload.record_id] || { reportCount: 0, maxSeverity: 0 };
      const metaB = recordMeta[b.payload.record_id] || { reportCount: 0, maxSeverity: 0 };

      if (sortBy === 'REPORTS') {
        return metaB.reportCount - metaA.reportCount;
      }
      if (sortBy === 'SEVERITY') {
        return metaB.maxSeverity - metaA.maxSeverity;
      }
      // Default: DATE (by createdAt descending)
      return b.createdAt > a.createdAt ? 1 : -1;
    });

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0' }}>Civic Audit Dashboard</h1>
        <p style={{ margin: 0, color: '#444', fontSize: '14px' }}>
          Real-time on-chain tracking for public supply chains and civic projects.
        </p>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ border: '1px solid #ccc', padding: '12px', background: '#fafafa' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>OFFICIAL RECORDS</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stats.totalRecords}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '12px', background: '#fafafa' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>GROUND REPORTS</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stats.totalReports}</div>
        </div>
        <div
          style={{
            border: '1px solid #ccc',
            padding: '12px',
            background: stats.coverUpsDetected > 0 ? '#fff0f0' : '#fafafa',
            borderColor: stats.coverUpsDetected > 0 ? '#d32f2f' : '#ccc',
          }}
        >
          <div style={{ fontSize: '12px', color: stats.coverUpsDetected > 0 ? '#d32f2f' : '#666' }}>
            COVER-UPS DETECTED
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: stats.coverUpsDetected > 0 ? '#d32f2f' : '#000',
            }}
          >
            {stats.coverUpsDetected}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '12px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          background: '#fff',
        }}
      >
        <input
          type="text"
          placeholder="Search by title, ID, district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', minWidth: '240px', border: '1px solid #999', fontSize: '13px' }}
        />

        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #999', fontSize: '13px' }}
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
          style={{ padding: '6px 10px', border: '1px solid #999', fontSize: '13px' }}
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
          style={{ padding: '6px 10px', border: '1px solid #999', fontSize: '13px' }}
        >
          <option value="DATE">Sort: Newest First</option>
          <option value="REPORTS">Sort: Most Reports</option>
          <option value="SEVERITY">Sort: Highest Severity</option>
        </select>

        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterConflictingOnly}
            onChange={(e) => setFilterConflictingOnly(e.target.checked)}
          />
          Has Conflicting Reports
        </label>

        <button
          onClick={loadData}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            fontSize: '13px',
            background: '#eee',
            border: '1px solid #999',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Records Table */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#666' }}>
          Querying Arkiv entities from Tiramisu chain...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ border: '1px dashed #ccc', padding: '30px', textAlign: 'center', color: '#666' }}>
          No records match your filters.{' '}
          <Link href="/new" style={{ color: '#0066cc' }}>
            Create one now
          </Link>{' '}
          or run the seed script.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #ccc' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ccc' }}>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Record ID</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Title</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Kind</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>District / Ward</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Official Status</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Dispatched / Rcvd</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #ccc' }}>Reports</th>
                <th style={{ padding: '8px 12px' }}>Audit Flag</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = recordMeta[r.payload.record_id] || { reportCount: 0, isCoverUp: false };
                return (
                  <tr
                    key={r.payload.record_id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: meta.isCoverUp ? '#fffdfd' : '#fff',
                    }}
                  >
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee', fontFamily: 'monospace' }}>
                      <Link
                        href={`/records/${r.payload.record_id}`}
                        style={{ color: '#0066cc', textDecoration: 'underline' }}
                      >
                        {r.payload.record_id}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee', fontWeight: '500' }}>
                      <Link href={`/records/${r.payload.record_id}`} style={{ color: '#000', textDecoration: 'none' }}>
                        {r.payload.title}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee' }}>{r.payload.kind}</td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee' }}>
                      {r.payload.district} ({r.payload.ward_id})
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          border: '1px solid #ccc',
                          background:
                            r.payload.status === 'ALL_GOOD_DELIVERED' || r.payload.status === 'DELIVERED'
                              ? '#f0fff0'
                              : r.payload.status === 'DAMAGED'
                              ? '#fff0f0'
                              : '#f5f5f5',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {r.payload.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee' }}>
                      {r.payload.quantity_dispatched} / {r.payload.quantity_received}
                    </td>
                    <td style={{ padding: '8px 12px', borderRight: '1px solid #eee' }}>
                      {meta.reportCount > 0 ? (
                        <span>
                          <strong>{meta.reportCount}</strong> reports
                        </span>
                      ) : (
                        <span style={{ color: '#888' }}>0</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {meta.isCoverUp ? (
                        <span
                          style={{
                            color: '#d32f2f',
                            fontWeight: 'bold',
                            border: '1px solid #d32f2f',
                            padding: '2px 6px',
                            background: '#ffebee',
                            fontSize: '11px',
                          }}
                        >
                          [COVER-UP FLAGGED]
                        </span>
                      ) : (
                        <span style={{ color: '#388e3c', fontSize: '11px' }}>Clean</span>
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
