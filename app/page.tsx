'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { HeroProductMock } from '@/components/HeroProductMock';
import { LiveChainStrip } from '@/components/LiveChainStrip';
import { ScrollExpand } from '@/components/ScrollExpand';
import { AnimatedContent } from '@/components/AnimatedContent';
import { EXPLORER_URL, FAUCET_URL } from '@/lib/arkiv';
import { ChevronDown } from 'lucide-react';

export default function LandingPage() {
  const [isScrollExpanded, setIsScrollExpanded] = useState(false);

  return (
    <div style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', minHeight: '100vh' }}>
      {/* ============================================================ */}
      {/* SCROLL EXPAND HERO REVEAL                                    */}
      {/* ============================================================ */}
      <ScrollExpand
        useWindowScroll
        startWidth={38}
        startHeight={52}
        startRadius={24}
        endRadius={0}
        mediaZoom={1.12}
        scrollDistance={0.85}
        holdDistance={0.15}
        overlayScrim={0.5}
        fadeMediaOnExpand
        onProgress={(p) => {
          setIsScrollExpanded(p >= 0.65);
        }}
        customMedia={
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0c0b09',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              gap: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Orange spiral logo positioned cleanly above the text */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/logo.svg"
                alt="Krix"
                width={80}
                height={80}
                style={{
                  display: 'block',
                  filter: 'drop-shadow(0 0 24px rgba(204, 138, 100, 0.35))',
                  userSelect: 'none',
                }}
              />
            </div>

            {/* Central text positioned below the logo with zero overlap */}
            <div
              style={{
                textAlign: 'center',
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-sans, sans-serif)',
                  lineHeight: 1.15,
                }}
              >
                Krix
              </div>
              <div
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  fontWeight: 600,
                }}
              >
                Public Audit Ledger
              </div>
            </div>
          </div>
        }
        scrollHint={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            Scroll to inspect ledger <ChevronDown size={14} />
          </span>
        }
      >
        <div style={{ textAlign: 'center', maxWidth: '720px', padding: '0 20px' }}>
          <AnimatedContent
            distance={60}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            blur={4}
            stagger={0.12}
            play={isScrollExpanded}
            once={false}
          >
            <div
              className="eyebrow"
              style={{
                letterSpacing: '0.1em',
                marginBottom: '12px',
                color: 'var(--accent)',
              }}
            >
              PERMANENT &bull; UNALTERABLE &bull; PUBLIC
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                marginBottom: '16px',
                color: 'var(--text-main)',
                lineHeight: 1.2,
              }}
            >
              Supplies can be delayed.
              <br />
              Truth cannot be deleted.
            </h2>
            <p
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              Every dispatch, transit claim, and village complaint is written to the blockchain. No official can silently edit away a broken road or missing medicines.
            </p>
          </AnimatedContent>
        </div>
      </ScrollExpand>

      {/* ============================================================ */}
      {/* SECTION: HERO & ROLE SELECTION                               */}
      {/* ============================================================ */}
      <section id="hero-roles" className="section-pad" style={{ paddingTop: '72px', paddingBottom: '72px' }}>
        <div className="container" style={{ maxWidth: '1040px' }}>
          <AnimatedContent
            distance={50}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            stagger={0.12}
            threshold={0.1}
            style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 40px' }}
          >
            <div className="eyebrow" style={{ letterSpacing: '0.08em', marginBottom: '14px' }}>
              TAMPER-PROOF PUBLIC AUDIT
            </div>

            <h1 className="hero-title" style={{ marginBottom: '20px' }}>
              A tamper-proof record of public promises and what actually happened.
            </h1>

            <p className="body-lead" style={{ margin: '0 auto', maxWidth: '720px', fontSize: '18px', lineHeight: 1.6 }}>
              Krix keeps a permanent, unalterable log of goods and services promised to communities alongside eyewitness reports from the people who live there. No official can silently edit away a broken road or missing medicines, and no complaint can be deleted once submitted.
            </p>
          </AnimatedContent>

          {/* Role Cards: Citizen & Authority side by side */}
          <AnimatedContent
            distance={50}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            threshold={0.1}
            stagger={0.15}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              maxWidth: '920px',
              margin: '0 auto 36px',
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
                  Wallet is needed.
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
          </AnimatedContent>


          {/* Hero Visual: Subtle product mock placed below role cards */}
          <AnimatedContent distance={40} direction="vertical" duration={0.8} ease="power3.out" threshold={0.1}>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
                Interactive Preview: How contradictory records are automatically caught
              </div>
              <HeroProductMock />
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* Thin Live Strip: Real chain numbers right under hero cards */}
      <LiveChainStrip />

      {/* ============================================================ */}
      {/* SECTION: AT A GLANCE                                         */}
      {/* ============================================================ */}
      <section id="product" className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container" style={{ maxWidth: '880px', textAlign: 'center' }}>
          <AnimatedContent distance={40} direction="vertical" duration={0.8} ease="power3.out" stagger={0.1} threshold={0.15}>
            <div className="eyebrow">AT A GLANCE</div>
            <h2 className="section-title">
              With Krix, the paper trail can&apos;t be rewritten.
            </h2>
            <p className="body-lead" style={{ margin: '0 auto' }}>
              Traditional government portals rely on centralized SQL databases where an administrator or official can silently edit delivery numbers, delete complaints, or overturn failed audits. Krix separates the official transit log from the ground reality reporting layer. Every handover requires cryptographic custody transfer, every citizen complaint is permanent, and our time-travel engine automatically surfaces cover-ups by comparing history against real-world reports.
            </p>
          </AnimatedContent>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: HOW THE PIECES FIT TOGETHER (THREE PILLARS)         */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <AnimatedContent distance={40} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 80px' }}>
              <div className="eyebrow">HOW THE PIECES FIT TOGETHER</div>
              <h2 className="section-title">
                Three pillars of permanent accountability.
              </h2>
            </div>
          </AnimatedContent>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '96px' }}>
            {/* Pillar 1 */}
            <AnimatedContent distance={50} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
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
            </AnimatedContent>

            {/* Pillar 2 */}
            <AnimatedContent distance={50} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
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
            </AnimatedContent>

            {/* Pillar 3 */}
            <AnimatedContent distance={50} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
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
            </AnimatedContent>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: UNDER THE HOOD                                      */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="container">
          <AnimatedContent distance={40} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 48px' }}>
              <div className="eyebrow">UNDER THE HOOD</div>
              <h2 className="section-title">
                Open infrastructure, verifiable primitives.
              </h2>
            </div>
          </AnimatedContent>

          <AnimatedContent
            distance={50}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            stagger={0.14}
            threshold={0.15}
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
          </AnimatedContent>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION: ILLUSTRATIVE SCENARIOS                              */}
      {/* ============================================================ */}
      <section className="section-pad" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <AnimatedContent distance={40} direction="vertical" duration={0.8} ease="power3.out" threshold={0.15}>
            <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px' }}>
              <div className="eyebrow">ILLUSTRATIVE SCENARIOS</div>
              <h2 className="section-title">
                How Krix resolves real-world civic disputes.
              </h2>
              <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>
                Illustrative scenarios, not real customer records.
              </p>
            </div>
          </AnimatedContent>

          <AnimatedContent
            distance={50}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            stagger={0.14}
            threshold={0.15}
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
              <span className="badge badge-warning" style={{ marginBottom: '12px' }}>
                QUANTITY SHORTAGE
              </span>
              <h3 className="card-title">Flood-Relief Ration Kits</h3>
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
          </AnimatedContent>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                       */}
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
                  Roles
                </div>
                <Link href="/citizen" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Citizen
                </Link>
                <Link href="/authority" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Authority
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                  Platform
                </div>
                <Link href="/records" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Records
                </Link>
                <Link href="/how-it-works" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  How It Works
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-faint)', letterSpacing: '0.08em' }}>
                  Tiramisu Network
                </div>
                <a href={EXPLORER_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  Block Explorer
                </a>
                <a href={FAUCET_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                  $GLM Faucet
                </a>
                <a href="https://github.com/Shivangi-Sharma06/krix" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
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
