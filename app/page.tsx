'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeroProductMock } from '@/components/HeroProductMock';
import { LiveChainStrip } from '@/components/LiveChainStrip';
import { LandingInteractiveDemo } from '@/components/LandingInteractiveDemo';
import { LandingFaq } from '@/components/LandingFaq';
import { fetchCivicRecords, fetchGroundReports, RPC_URL, EXPLORER_URL, FAUCET_URL } from '@/lib/arkiv';
import { detectCoverUp } from '@/lib/detect';
import { ShieldCheck, Eye, History, ArrowRight, Truck, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export default function LandingPage() {
  const [liveBlock, setLiveBlock] = useState<bigint | null>(null);
  const [stats, setStats] = useState({
    recordsCount: 0,
    reportsCount: 0,
    flaggedCount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function loadChainStats() {
      try {
        setStatsLoading(true);
        // Query live block number
        const blkRes = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        });
        const blkData = await blkRes.json();
        if (blkData.result) {
          setLiveBlock(BigInt(blkData.result));
        }

        const records = await fetchCivicRecords();
        let totalReps = 0;
        let flagged = 0;

        for (const r of records) {
          const reps = await fetchGroundReports(r.key);
          totalReps += reps.length;
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
          if (detection.isCoverUp) flagged++;
        }

        setStats({
          recordsCount: records.length,
          reportsCount: totalReps,
          flaggedCount: flagged,
        });
      } catch (err) {
        console.warn('Stats fetch issue:', err);
      } finally {
        setStatsLoading(false);
      }
    }

    loadChainStats();
  }, []);

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', minHeight: '100vh' }}>
      {/* ============================================================ */}
      {/* SECTION C: HERO                                              */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ paddingTop: '72px', paddingBottom: '72px' }}>
        <div className="container" style={{ maxWidth: '1040px' }}>
          {/* Eyebrow, Headline, and Calm Plain-Language Explanation */}
          <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 40px' }}>
            <div className="eyebrow" style={{ letterSpacing: '0.08em', marginBottom: '14px' }}>
              TAMPER-PROOF PUBLIC AUDIT
            </div>

            <h1 className="hero-title" style={{ marginBottom: '20px' }}>
              A tamper-proof record of public promises and what actually happened.
            </h1>

            <p className="body-lead" style={{ margin: '0 auto', maxWidth: '720px', fontSize: '18px', lineHeight: 1.6 }}>
              Krix keeps a permanent, unalterable log of goods and services promised to communities alongside eyewitness reports from the people who live there. No official can silently edit away a broken road or missing medicines, and no complaint can be deleted once submitted.
            </p>
          </div>

          {/* Role Cards: Main Call to Action (Side-by-side on desktop, stacked on mobile) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              maxWidth: '920px',
              margin: '0 auto 48px',
            }}
          >
            {/* Card 1: Citizen */}
            <Link
              href="/citizen"
              className="card"
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '32px 28px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--bg-surface)',
                outline: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-raised)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', fontSize: '11px', textTransform: 'uppercase' }}>
                    For Residents &amp; Patients
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Free to use</span>
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
                  I am a citizen
                </h2>

                <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                  Tell whether a promised delivery reached your village, file a complaint with photo evidence, see the authority&apos;s verified response, and confirm when issues are fixed.
                </p>
              </div>

              <div>
                <span
                  className="btn btn-secondary btn-lg"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: '10px',
                    fontWeight: 600,
                    pointerEvents: 'none',
                  }}
                >
                  Continue as citizen &rarr;
                </span>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-faint)' }}>
                  No account needed.
                </div>
              </div>
            </Link>

            {/* Card 2: Authority */}
            <Link
              href="/authority"
              className="card"
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '32px 28px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--bg-surface)',
                outline: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-raised)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span className="badge" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-strong)', fontSize: '11px', textTransform: 'uppercase' }}>
                    For Officials &amp; Contractors
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>On-Chain Signoff</span>
                </div>

                <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
                  I am an authority
                </h2>

                <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                  Publish an official promise, review complaints filed from villages, reply with verified transit updates, transfer custody at each checkpoint, and keep your record honest.
                </p>
              </div>

              <div>
                <span
                  className="btn btn-primary btn-lg"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: '10px',
                    fontWeight: 600,
                    pointerEvents: 'none',
                  }}
                >
                  Continue as authority &rarr;
                </span>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-faint)' }}>
                  Connect a wallet.
                </div>
              </div>
            </Link>
          </div>

          {/* Hero Visual: Subtle product mock placed below role cards */}
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
              Interactive Preview: How contradictory records are automatically caught
            </div>
            <HeroProductMock />
          </div>
        </div>
      </section>

      {/* Thin Live Strip: Real chain numbers right under hero cards */}
      <LiveChainStrip />

      {/* ============================================================ */}
      {/* SECTION D: AT A GLANCE                                       */}
      {/* ============================================================ */}
      <section id="product" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container" style={{ maxWidth: '880px', textAlign: 'center' }}>
          <div className="eyebrow">AT A GLANCE</div>
          <h2 className="section-title">
            With Krix, the paper trail can&apos;t be rewritten.
          </h2>
          <p className="body-lead" style={{ margin: '0 auto' }}>
            Traditional government portals rely on centralized SQL databases where an administrator or official can silently edit delivery numbers, delete complaints, or overturn failed audits. Krix separates the official transit log from the ground reality reporting layer. Every handover requires cryptographic custody transfer, every citizen complaint is permanent, and our time-travel engine automatically surfaces cover-ups by comparing history against real-world reports.
          </p>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION E: THE BOTTOM LINE                                   */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 60px' }}>
            <div className="eyebrow">THE BOTTOM LINE</div>
            <h2 className="section-title">
              Three mechanisms for absolute civic transparency.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            <div className="card">
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}>
                <ShieldCheck size={28} />
              </div>
              <h3 className="card-title">Track every handover</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px' }}>
                Batches are created with a sealed genesis manifest. Ownership passes from state warehouse to distributor to clinic via on-chain custody transfers. Only the current custodian can update status.
              </p>
              <Link href="/records" style={{ fontSize: '14px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View custody chain &rarr;
              </Link>
            </div>

            <div className="card">
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}>
                <Eye size={28} />
              </div>
              <h3 className="card-title">Let anyone report the truth</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px' }}>
                Field inspectors, doctors, and residents submit photo proof and severity ratings. Every submission is committed with permanent readonly flags. No minister or database admin can remove it.
              </p>
              <Link href="/how-it-works" style={{ fontSize: '14px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Read about immutability &rarr;
              </Link>
            </div>

            <div className="card">
              <div style={{ color: 'var(--accent)', marginBottom: '16px' }}>
                <History size={28} />
              </div>
              <h3 className="card-title">Catch the cover-up</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px' }}>
                When officials attempt to flip a failing batch to &ldquo;All Good Delivered&rdquo; or inflate quantities, the time-travel engine scrubs historical blocks via <code>atBlock</code> queries to flag discrepancies.
              </p>
              <Link href="#demo" style={{ fontSize: '14px', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Try interactive diff &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION F: WHO IT'S FOR                                      */}
      {/* ============================================================ */}
      <section id="who-its-for" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 60px' }}>
            <div className="eyebrow">WHO IT&apos;S FOR</div>
            <h2 className="section-title">
              Designed for everyone in the delivery chain.
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Practical accountability without requiring participants to be blockchain experts.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            <div className="card-raised">
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
                Origin &amp; Logistics
              </div>
              <h3 className="card-title">State Warehouses &amp; Distributors</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                Register new supply batches, seal immutable dispatch manifests, and transfer legal custody cryptographically as trucks leave storage.
              </p>
            </div>

            <div className="card-raised">
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
                Receiving Centers
              </div>
              <h3 className="card-title">Rural Clinics &amp; PHCs</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                Confirm exact received stock counts, report rain damage or broken seals upon arrival, and protect clinical staff from false delivery claims.
              </p>
            </div>

            <div className="card-raised">
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
                Field Quality Audits
              </div>
              <h3 className="card-title">Field Inspectors &amp; Doctors</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                File tamper-proof quality inspections and laboratory test findings with photo evidence that cannot be silenced by higher officials.
              </p>
            </div>

            <div className="card-raised">
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
                Ward Beneficiaries
              </div>
              <h3 className="card-title">Citizens &amp; Patients</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                Verify whether allocated medicines actually reached local dispensaries, report shortages, and extend the lifetime of critical complaints.
              </p>
            </div>

            <div className="card-raised" style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
                Public Oversight
              </div>
              <h3 className="card-title">Journalists &amp; Civic Watchdogs</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                Scrub historical blocks using time-travel queries, verify cryptographic proof hashes, and export unalterable forensic evidence packages.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION G: TRUTH IS A CONVERSATION                           */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 80px' }}>
            <div className="eyebrow">HOW THE PIECES FIT TOGETHER</div>
            <h2 className="section-title">
              Three pillars of permanent accountability.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}>
            {/* Row 1 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '48px',
                alignItems: 'center',
              }}
            >
              <div>
                <div className="eyebrow">PILLAR ONE</div>
                <h3 className="section-title" style={{ fontSize: '32px' }}>
                  Custody handover with changeOwnership
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6, marginBottom: '20px' }}>
                  A batch cannot be updated by whoever happens to have server access. At every hop from State Warehouse to Transport Fleet to Local Dispensary, the sending custodian transfers ownership on-chain. The moment custody transfers, the sender loses write access forever.
                </p>
                <div style={{ color: 'var(--text-faint)', fontSize: '13px' }} className="mono">
                  Primitive: Arkiv changeOwnership() &middot; Event: OwnershipTransferred
                </div>
              </div>

              {/* Mock: Custody chain stepper */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '16px' }}>
                  On-Chain Custody Stepper
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                      1
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>State Warehouse (Vijayawada)</div>
                      <div className="mono" style={{ fontSize: '12px', color: 'var(--text-faint)' }}>0xc360...16cf9 &middot; Block #410100</div>
                    </div>
                  </div>

                  <div style={{ borderLeft: '2px dashed var(--border-strong)', height: '16px', marginLeft: '13px' }} />

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                      2
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>District Logistics Truck 1024</div>
                      <div className="mono" style={{ fontSize: '12px', color: 'var(--text-faint)' }}>0x2b3c...012b &middot; Block #410140</div>
                    </div>
                  </div>

                  <div style={{ borderLeft: '2px dashed var(--border-strong)', height: '16px', marginLeft: '13px' }} />

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                      3
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>PHC Mangalagiri (Current Custodian)</div>
                      <div className="mono" style={{ fontSize: '12px', color: 'var(--text-faint)' }}>0x3c4d...23c4 &middot; Block #410180</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '48px',
                alignItems: 'center',
              }}
            >
              {/* Mock: Report Card */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="badge badge-danger">DEFECT REPORT &middot; SEV 9/10</span>
                  <span className="badge badge-default mono">readonly: true</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
                  Medical Officer &middot; PHC Mangalagiri OPD
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                  &ldquo;Cartons soaked in water during rain transit. Broken tamper seals on 200 vials. Immediate replacement needed.&rdquo;
                </p>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-faint)' }}>
                  <span>Lifetime: 28 days remaining</span>
                  <button className="btn btn-secondary btn-md" style={{ height: '28px', fontSize: '11px' }}>
                    Extend Life (+30d)
                  </button>
                </div>
              </div>

              <div>
                <div className="eyebrow">PILLAR TWO</div>
                <h3 className="section-title" style={{ fontSize: '32px' }}>
                  Uncensorable ground reality form
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6, marginBottom: '20px' }}>
                  Anyone on the ground can register an observation. Reports are written with the cryptographic <code>readonly: true</code> flag. No minister, politician, or database administrator can modify or delete a filed complaint. With <code>permissionlessExtension: true</code>, any resident can extend a complaint&apos;s storage life.
                </p>
                <div style={{ color: 'var(--text-faint)', fontSize: '13px' }} className="mono">
                  Primitive: Arkiv readonly &middot; Photo: IPFS with stripped EXIF GPS
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '48px',
                alignItems: 'center',
              }}
            >
              <div>
                <div className="eyebrow">PILLAR THREE</div>
                <h3 className="section-title" style={{ fontSize: '32px' }}>
                  Time-travel diff queries via atBlock
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6, marginBottom: '20px' }}>
                  When an official alters a damaged batch record to &ldquo;Delivered All Good&rdquo;, they leave an immutable fingerprint. Krix uses Arkiv&apos;s <code>atBlock</code> primitive to query past states and generates red/green diffs that prove the record was altered after complaints were filed.
                </p>
                <div style={{ color: 'var(--text-faint)', fontSize: '13px' }} className="mono">
                  Query: publicClient.select().atBlock(height)
                </div>
              </div>

              {/* Mock: Red/Green diff */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '12px' }}>
                  Forensic Red / Green Diff (Block #410180 vs Now)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>FIELD: STATUS</div>
                    <div className="diff-removed" style={{ marginBottom: '4px' }}>
                      - status: &quot;DAMAGED&quot; (at block #410180)
                    </div>
                    <div className="diff-added">
                      + status: &quot;ALL_GOOD_DELIVERED&quot; (at block #410290)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '4px' }}>FIELD: QUANTITY_RECEIVED</div>
                    <div className="diff-removed" style={{ marginBottom: '4px' }}>
                      - quantity_received: 300
                    </div>
                    <div className="diff-added">
                      + quantity_received: 500
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION H: SUPPLY FLOW, VERIFIED                             */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container" style={{ maxWidth: '780px' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="eyebrow">SUPPLY FLOW, VERIFIED</div>
            <h2 className="section-title">
              Five verifiable checkpoints from source to citizen.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: '20px', top: '16px', bottom: '16px', width: '2px', backgroundColor: 'var(--border-strong)', zIndex: 0 }} />

            {[
              {
                step: '01',
                title: 'State Warehouse creates the batch',
                desc: 'A mutable civic_record is registered alongside an immutable dispatch_manifest containing the original dispatch quantity, kind, and destination.',
                badge: 'createEntity',
              },
              {
                step: '02',
                title: 'Handover to transport distributor',
                desc: 'State warehouse signs changeOwnership transaction to the transport operator wallet. The warehouse can no longer edit the batch.',
                badge: 'changeOwnership',
              },
              {
                step: '03',
                title: 'Receipt at rural clinic',
                desc: 'Local receiving officer inspects incoming cartons and logs physical delivery numbers and transit condition.',
                badge: 'patchEntity',
              },
              {
                step: '04',
                title: 'Independent ground reports filed',
                desc: 'Doctors, field quality auditors, and citizens file permanent reports with photos on IPFS and readonly flags.',
                badge: 'readonly: true',
              },
              {
                step: '05',
                title: 'Cover-up check flags discrepancies',
                desc: 'The pure detection engine queries historical block states via atBlock and alerts watchdogs if status was flipped contrary to field evidence.',
                badge: 'atBlock diff',
              },
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-surface-raised)',
                    border: '2px solid var(--accent)',
                    color: 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                  className="mono"
                >
                  {item.step}
                </div>
                <div className="card" style={{ flex: 1, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{item.title}</h3>
                    <span className="badge badge-accent mono" style={{ fontSize: '11px' }}>
                      {item.badge}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION I: INTERACTIVE LIVE DEMO                             */}
      {/* ============================================================ */}
      <section id="demo" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px' }}>
            <div className="eyebrow">INTERACTIVE DEMO</div>
            <h2 className="section-title">
              Scrub history in real-time.
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Drag the block slider below to query past states and observe how Krix uncovers alterations.
            </p>
          </div>

          <LandingInteractiveDemo />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION J: BUILT ON                                          */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px' }}>
            <div className="eyebrow">UNDER THE HOOD</div>
            <h2 className="section-title">
              Open infrastructure, verifiable primitives.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
            }}
          >
            <div className="card">
              <h3 className="card-title">Arkiv Network</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                High-performance database rollup enabling structured entity querying, rent-based lifetime extension, and cryptographic readonly guarantees.
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">Tiramisu Testnet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                Dedicated Ethereum Layer 3 execution network (Chain ID: 7738577) with sub-second block finality and gas settled in testnet $GLM.
              </p>
            </div>

            <div className="card">
              <h3 className="card-title">IPFS Storage</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                Decentralized media storage for ground reality photos. Client-side EXIF GPS coordinates are stripped before upload to protect whistleblower privacy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION K: LIVE FROM THE CHAIN                               */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px' }}>
            <div className="eyebrow">LIVE FROM THE CHAIN</div>
            <h2 className="section-title">
              Real-time on-chain statistics.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
                Batches Tracked
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text-main)' }}>
                {statsLoading ? '—' : stats.recordsCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Registered on Tiramisu L3
              </div>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
                Ground Reports
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: 'var(--text-main)' }}>
                {statsLoading ? '—' : stats.reportsCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Sealed with readonly: true
              </div>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
                Contradictions Flagged
              </div>
              <div style={{ fontSize: '36px', fontWeight: 600, color: stats.flaggedCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
                {statsLoading ? '—' : stats.flaggedCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Cover-up alterations detected
              </div>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: '8px' }}>
                Live Block Height
              </div>
              <div className="mono" style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text-main)' }}>
                {liveBlock ? `#${liveBlock.toString()}` : '—'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Polled via active RPC
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION L: ILLUSTRATIVE SCENARIOS                            */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px' }}>
            <div className="eyebrow">ILLUSTRATIVE SCENARIOS</div>
            <h2 className="section-title">
              How Krix resolves real-world civic disputes.
            </h2>
            <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>
              Illustrative scenarios, not real customer records.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            <div className="card">
              <span className="badge badge-warning" style={{ marginBottom: '12px' }}>
                MEDICINE TRANSIT DAMAGE
              </span>
              <h3 className="card-title">500 Dengue Testing Kits</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
                200 kits arrive with broken seals and rain damage at a rural health center. An official later flips the delivery record to &ldquo;Delivered 500 Pristine&rdquo;. Krix flags the reversal using the doctor&apos;s photos and inspector reports.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }} className="mono">
                Outcome: Discrepancy score 92/100 &middot; Forensics exported
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Flood-Relief Ration Kits</h3>
              <span className="badge badge-warning" style={{ marginBottom: '12px' }}>
                QUANTITY SHORTAGE
              </span>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
                1,000 emergency food packets dispatched; only 700 distributed in the flood zone. The reconciliation bar highlights the 300-packet gap between the dispatch manifest and citizen confirmations.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }} className="mono">
                Outcome: Shortfall flagged on public dashboard
              </div>
            </div>

            <div className="card">
              <span className="badge badge-warning" style={{ marginBottom: '12px' }}>
                CIVIC INFRASTRUCTURE
              </span>
              <h3 className="card-title">Ward 14 Road Resurfacing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '14px' }}>
                Contractor marks road repair as 100% completed. Residents file 5 immutable reports documenting unresolved potholes. The system prevents premature payment signoff without physical audit verification.
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-faint)' }} className="mono">
                Outcome: Citizen evidence preserved on-chain
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION L-B: WHAT KRIX CAN AND CANNOT PROVE                  */}
      {/* ============================================================ */}
      <section id="limits-and-guarantees" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container" style={{ maxWidth: '980px' }}>
          <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
            <div className="eyebrow">HONEST GUARANTEES &amp; BOUNDARIES</div>
            <h2 className="section-title">
              What Krix can and cannot prove.
            </h2>
            <p className="body-lead" style={{ margin: '0 auto', fontSize: '16px' }}>
              We believe civic tools must be honest about what cryptographic verification achieves and where human responsibility begins.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '32px',
            }}
          >
            {/* Box 1: What Krix CAN Prove */}
            <div
              className="card-raised"
              style={{
                padding: '28px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-app)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    color: '#34d399',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  ✓
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  What Krix CAN prove
                </h3>
              </div>

              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Contradictions between records and ground reality:</strong> Mathematically flags when an official marks a shipment &ldquo;Delivered&rdquo; while local residents or field clinics document missing or broken supplies.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Exact chronological history:</strong> Every status update, notes edit, and custody transfer is stamped on the Tiramisu blockchain. Historical states cannot be overwritten.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Tamper-proof evidence:</strong> Ground reports and photo proofs pinned to IPFS are stored as immutable, readonly entities. No administrative role can alter or censor them.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Chain of custody handovers:</strong> Proves exactly which wallet held authority over a consignment at any given block height.
                </li>
              </ul>
            </div>

            {/* Box 2: What Krix CANNOT Prove */}
            <div
              className="card-raised"
              style={{
                padding: '28px',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-app)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(248, 113, 113, 0.15)',
                    color: '#f87171',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  ✕
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                  What Krix CANNOT prove
                </h3>
              </div>

              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Physical reality on its own:</strong> Krix records what witnesses submit and what officials sign. It cannot physically detect a diversion if no citizen or inspector files a report.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Legal or criminal guilt:</strong> The software highlights discrepancy and cover-up patterns, but cannot determine legal intent, negligence vs accident, or assign judicial penalties.
                </li>
                <li>
                  <strong style={{ color: 'var(--text-main)' }}>Physical cargo contents:</strong> If a sealed box contains sand instead of medical vials, Krix cannot know until a clinician opens it and uploads a sworn report.
                </li>
              </ul>
            </div>
          </div>

          {/* Key Safeguards & Assumptions Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '6px' }}>
                Pseudonymous Privacy
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                Wallets are pseudonymous
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Citizen witnesses do not need to provide their name, phone, or identity to file reports. Submissions are signed with pseudonymous cryptographic keys to protect whistleblowers from retaliation.
              </p>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '6px' }}>
                Permanent Visibility
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                Reports are permanent &amp; public
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Every report and official response is permanently recorded in the Arkiv decentralized state. There is no admin &ldquo;delete&rdquo; button, no hidden censorship queue, and no private backchannel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION M: FAQ ACCORDION                                     */}
      {/* ============================================================ */}
      <section id="faq" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <div className="eyebrow">COMMON QUESTIONS</div>
            <h2 className="section-title">
              Frequently asked questions.
            </h2>
          </div>

          <LandingFaq />
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION N: FINAL CTA BAND                                    */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface-raised)', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          <div className="eyebrow">ACCOUNTABILITY FROM ORIGIN TO VILLAGE</div>
          <h2 className="section-title">
            Choose your role to get started.
          </h2>
          <p className="body-lead" style={{ margin: '0 auto 36px' }}>
            Whether you are verifying delivered supplies in your local clinic or managing official consignments, Krix provides an unalterable trail.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', maxWidth: '560px', margin: '0 auto 24px' }}>
            <Link
              href="/citizen"
              className="btn btn-secondary btn-lg"
              style={{ justifyContent: 'center', padding: '16px 20px', fontWeight: 600 }}
            >
              Continue as citizen &rarr;
            </Link>
            <Link
              href="/authority"
              className="btn btn-primary btn-lg"
              style={{ justifyContent: 'center', padding: '16px 20px', fontWeight: 600 }}
            >
              Continue as authority &rarr;
            </Link>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>
            Or <Link href="/records" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse all public records</Link> across districts.
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION O: FOOTER                                            */}
      {/* ============================================================ */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', padding: '64px 0 40px' }}>
        <div className="container">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '32px',
              marginBottom: '48px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <img src="/logo.svg" alt="Krix" width="24" height="24" />
                <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>Krix</span>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Supplies can be delayed. Truth cannot be deleted.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '32px', fontSize: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                  Platform
                </div>
                <Link href="/records" style={{ color: 'var(--text-muted)' }}>
                  Records
                </Link>
                <Link href="/new" style={{ color: 'var(--text-muted)' }}>
                  Create Record
                </Link>
                <Link href="/how-it-works" style={{ color: 'var(--text-muted)' }}>
                  How It Works
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                  Tiramisu Network
                </div>
                <a href={EXPLORER_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                  Block Explorer
                </a>
                <a href={FAUCET_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                  $GLM Faucet
                </a>
                <a href="https://github.com/Shivangi-Sharma06/krix" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)' }}>
                  GitHub
                </a>
              </div>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '24px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              fontSize: '12px',
              color: 'var(--text-faint)',
            }}
          >
            <div>
              Testnet project, not an official government system.
            </div>
            <div>
              &copy; 2026 Krix. Built on Arkiv &amp; Tiramisu testnet.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
