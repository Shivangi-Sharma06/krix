'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');

  return (
    <div className="app-container" style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '16px', fontSize: '13px' }}>
        <Link href="/records" style={{ color: 'var(--accent)', fontWeight: 500 }}>
          &larr; Back to Records
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <div className="eyebrow">Architecture &amp; Civic Verification</div>
          <h1 style={{ fontSize: '32px', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
            How Krix Works
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px' }}>
            Public accountability architecture explained in plain English and Hindi.
          </p>
        </div>

        {/* English / Hindi Toggle */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-surface-raised)', padding: '4px', borderRadius: 'var(--radius-btn)' }}>
          <button
            onClick={() => setLang('EN')}
            className={lang === 'EN' ? 'btn btn-primary btn-md' : 'btn btn-ghost btn-md'}
            style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
          >
            English
          </button>
          <button
            onClick={() => setLang('HI')}
            className={lang === 'HI' ? 'btn btn-primary btn-md' : 'btn btn-ghost btn-md'}
            style={{ height: '30px', padding: '0 12px', fontSize: '12px' }}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Module 1 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>MODULE 1</div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          1. Official Living Record &amp; Dispatch Manifest
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
          When a government agency dispatches medicines or initiates civic works, a mutable <code>civic_record</code> is registered alongside an immutable <code>dispatch_manifest</code> (with <code>readonly: true</code>).
          Legal custody is transferred cryptographically using <code>changeOwnership</code> ($A \to B \to C$). Only the current custodian may log transit updates.
        </p>

        {lang === 'HI' && (
          <div style={{ backgroundColor: 'var(--bg-surface-raised)', padding: '14px 18px', borderRadius: 'var(--radius-card)', borderLeft: '3px solid var(--accent)', fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6 }}>
            <strong>हिंदी में:</strong> जब सरकारी गोदाम से दवाइयाँ भेजी जाती हैं, तो ब्लॉकचेन पर एक आधिकारिक रिकॉर्ड और मूल घोषणा पत्र बनता है। केवल वर्तमान कस्टोडियन ही स्थिति बदल सकता है। जब कस्टडी अगले विभाग को सौंपी जाती है, तो पुराना विभाग उसमें कोई फेरबदल नहीं कर सकता।
          </div>
        )}
      </div>

      {/* Module 2 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>MODULE 2</div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          2. Uncensorable Ground Reality Reports
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
          Doctors, field quality inspectors, and local citizens file factual reports directly on the Arkiv blockchain with <code>readonly: true</code> and <code>permissionlessExtension: true</code>.
          Photo evidence is uploaded to IPFS with EXIF GPS coordinates stripped. No database admin, minister, or portal official can edit, alter, or hide citizen submissions.
        </p>

        {lang === 'HI' && (
          <div style={{ backgroundColor: 'var(--bg-surface-raised)', padding: '14px 18px', borderRadius: 'var(--radius-card)', borderLeft: '3px solid var(--accent)', fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6 }}>
            <strong>हिंदी में:</strong> डॉक्टर या आम नागरिक जो रिपोर्ट दर्ज करते हैं, वे हमेशा के लिए ब्लॉकचेन पर सुरक्षित हो जाती हैं। कोई भी मंत्री या डेटाबेस एडमिन इन शिकायतों को डिलीट नहीं कर सकता। कोई भी नागरिक छोटे से शुल्क से इन रिपोर्टों की जीवन अवधि बढ़ा सकता है।
          </div>
        )}
      </div>

      {/* Module 3 */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div className="eyebrow" style={{ color: 'var(--accent)' }}>MODULE 3</div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          3. Catch the Cover-Up: Time-Travel Engine
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 14px 0' }}>
          Corrupt officials often overwrite failing statuses (such as <code>DAMAGED</code>) to <code>ALL_GOOD_DELIVERED</code>.
          Krix&apos;s detection engine scrubs historical blocks via Arkiv <code>atBlock</code> queries, calculates a transparent 0–100 cover-up score, and exposes the exact block, wallet, and contradicting citizen evidence.
        </p>

        {lang === 'HI' && (
          <div style={{ backgroundColor: 'var(--bg-surface-raised)', padding: '14px 18px', borderRadius: 'var(--radius-card)', borderLeft: '3px solid var(--accent)', fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6 }}>
            <strong>हिंदी में:</strong> अगर कोई अधिकारी खराब दवाइयों को कागजों में &ldquo;सही&rdquo; दिखाकर छुपाने की कोशिश करता है, तो टाइम-ट्रैवल इंजन पुरानी स्थिति की तुलना करके इस हेराफेरी को रंगे हाथों पकड़ लेता है और अदालत व मीडिया के लिए डिजिटल सबूत तैयार करता है।
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/records" className="btn btn-primary btn-lg">
          Explore Public Records &rarr;
        </Link>
      </div>
    </div>
  );
}
