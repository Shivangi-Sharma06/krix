'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { RPC_URL, fetchCivicRecords, fetchGroundReports } from '@/lib/arkiv';
import { detectCoverUp } from '@/lib/detect';

interface ChainStats {
  promises: number;
  witnesses: number;
  complaints: number;
  responses: number;
  contradictions: number;
  latestBlock: number;
}

function useCountUp(target: number, durationMs: number = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    if (target === 0) {
      setValue(0);
      return;
    }

    let start = 0;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutQuad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(eased * target);
      setValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setValue(target);
      }
    }

    requestAnimationFrame(step);
  }, [target, durationMs]);

  return value;
}

export function LiveChainStrip() {
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLiveStrip() {
      try {
        setLoading(true);
        setError(null);

        // 1. Get latest block from Tiramisu RPC
        const blkRes = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        });

        if (!blkRes.ok) {
          throw new Error('RPC endpoint returned non-200');
        }

        const blkData = await blkRes.json();
        if (!blkData.result) {
          throw new Error('No block result from RPC');
        }
        const blockNum = parseInt(blkData.result, 16);

        // 2. Fetch records and reports
        const records = await fetchCivicRecords();
        let complaintsCount = 0;
        let responsesCount = 0;
        const witnessWallets = new Set<string>();
        let contradictionsCount = 0;

        await Promise.allSettled(
          records.slice(0, 10).map(async (r) => {
            if (r.owner) witnessWallets.add(r.owner.toLowerCase());
            if (r.creator) witnessWallets.add(r.creator.toLowerCase());

            if (r.payload.quantity_received > 0 || r.payload.notes) {
              responsesCount++;
            }

            try {
              const reps = await fetchGroundReports(r.key);
              complaintsCount += reps.length;
              for (const rp of reps) {
                if (rp.creator) witnessWallets.add(rp.creator.toLowerCase());
              }

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
              if (detection.isCoverUp) contradictionsCount++;
            } catch {
              // Ignore single record failure
            }
          })
        );

        if (isMounted) {
          setStats({
            promises: records.length,
            witnesses: witnessWallets.size,
            complaints: complaintsCount,
            responses: responsesCount,
            contradictions: contradictionsCount,
            latestBlock: blockNum,
          });
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Live data unavailable');
          setLoading(false);
        }
      }
    }

    loadLiveStrip();
    const interval = setInterval(loadLiveStrip, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const animatedPromises = useCountUp(stats?.promises || 0);
  const animatedWitnesses = useCountUp(stats?.witnesses || 0);
  const animatedComplaints = useCountUp(stats?.complaints || 0);
  const animatedResponses = useCountUp(stats?.responses || 0);
  const animatedContradictions = useCountUp(stats?.contradictions || 0);
  const animatedBlock = useCountUp(stats?.latestBlock || 0, 1000);

  if (loading && !stats) {
    return (
      <div
        className="live-chain-strip"
        role="status"
        aria-label="Live chain data loading"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          color: 'var(--text-faint)',
          fontSize: '13px',
        }}
      >
        <span
          className="spinner"
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>Connecting to Tiramisu chain &amp; querying live records...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div
        className="live-chain-strip"
        role="alert"
        style={{
          borderTop: '1px solid var(--danger-border)',
          borderBottom: '1px solid var(--danger-border)',
          backgroundColor: 'var(--danger-bg)',
          padding: '12px 20px',
          textAlign: 'center',
          color: 'var(--danger)',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        Live data unavailable &mdash; Tiramisu testnet RPC is currently unreachable.
      </div>
    );
  }

  return (
    <aside
      className="live-chain-strip"
      aria-label="Real-time blockchain statistics"
      style={{
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        padding: '14px 0',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px 28px',
          }}
        >
          {/* Live indicator dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: 'var(--success)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)', fontWeight: 600 }}>
              Live on Tiramisu
            </span>
          </div>

          {/* Metric 1: Promises */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Promises
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
              {animatedPromises}
            </span>
          </div>

          {/* Metric 2: Witnesses */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Witnesses
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>
              {animatedWitnesses}
            </span>
          </div>

          {/* Metric 3: Complaints */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Complaints
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--danger)' }}>
              {animatedComplaints}
            </span>
          </div>

          {/* Metric 4: Responses */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Responses
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--success)' }}>
              {animatedResponses}
            </span>
          </div>

          {/* Metric 5: Contradictions */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Contradictions Flagged
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: animatedContradictions > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {animatedContradictions}
            </span>
          </div>

          {/* Metric 6: Latest Block */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
              Latest Block
            </span>
            <span className="mono" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>
              #{animatedBlock.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
