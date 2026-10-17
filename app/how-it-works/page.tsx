'use client';

import React from 'react';
import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontSize: '15px', lineHeight: '1.6' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '600', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
          How JanAudit Works
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Public accountability architecture explained in plain English and Hindi.
        </p>
      </div>

      {/* Module 1 */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--primary)' }}>
          1. Official Living Record & Dispatch Manifest
        </h2>
        <p style={{ margin: '0 0 10px 0' }}>
          When a government agency dispatches medicines or initiates civic works, a mutable <code>civic_record</code> is registered alongside an immutable <code>dispatch_manifest</code> (with <code>readonly: true</code>).
          Legal custody is transferred cryptographically using <code>changeOwnership</code> ($A \to B \to C$). Only the current custodian may log transit updates.
        </p>
        <div style={{ background: '#FAFAFA', padding: '12px', borderRadius: '4px', borderLeft: '3px solid var(--primary)', fontSize: '14px', color: '#333' }}>
          <strong>हिंदी में:</strong> जब सरकारी गोदाम से दवाइयाँ भेजी जाती हैं, तो ब्लॉकचेन पर एक आधिकारिक रिकॉर्ड और मूल घोषणा पत्र बनता है। केवल वर्तमान कस्टोडियन ही स्थिति बदल सकता है।
        </div>
      </div>

      {/* Module 2 */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--primary)' }}>
          2. Uncensorable Ground Reality Reports
        </h2>
        <p style={{ margin: '0 0 10px 0' }}>
          Doctors, field quality inspectors, and local citizens file factual reports directly on the Arkiv blockchain with <code>readonly: true</code> and <code>permissionlessExtension: true</code>.
          Photo evidence is uploaded to IPFS with EXIF GPS coordinates stripped. No database admin, minister, or portal official can edit, alter, or hide citizen submissions.
        </p>
        <div style={{ background: '#FAFAFA', padding: '12px', borderRadius: '4px', borderLeft: '3px solid var(--primary)', fontSize: '14px', color: '#333' }}>
          <strong>हिंदी में:</strong> डॉक्टर या आम नागरिक जो रिपोर्ट दर्ज करते हैं, वे हमेशा के लिए ब्लॉकचेन पर सुरक्षित हो जाती हैं। कोई भी मंत्री या डेटाबेस एडमिन इन शिकायतों को डिलीट नहीं कर सकता।
        </div>
      </div>

      {/* Module 3 */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: 'var(--primary)' }}>
          3. Catch the Cover-Up: Time-Travel Engine
        </h2>
        <p style={{ margin: '0 0 10px 0' }}>
          Corrupt officials often overwrite failing statuses (such as <code>DAMAGED</code>) to <code>ALL_GOOD_DELIVERED</code>.
          JanAudit's detection engine scrubs historical blocks via Arkiv <code>atBlock</code> queries, calculates a transparent 0–100 cover-up score, and exposes the exact block, wallet, and contradicting citizen evidence.
        </p>
        <div style={{ background: '#FAFAFA', padding: '12px', borderRadius: '4px', borderLeft: '3px solid var(--primary)', fontSize: '14px', color: '#333' }}>
          <strong>हिंदी में:</strong> अगर कोई अधिकारी खराब दवाइयों को कागजों में "सही" दिखाकर छुपाने की कोशिश करता है, तो टाइम-ट्रैवल इंजन पुरानी स्थिति की तुलना करके इस हेराफेरी को रंगे हाथों पकड़ लेता है।
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/" className="btn-primary">
          Explore Public Records
        </Link>
      </div>
    </div>
  );
}
