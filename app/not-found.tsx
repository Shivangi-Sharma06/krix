'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: '80px', paddingBottom: '80px', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '36px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          404 &middot; Not Found
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text)' }}>
          Record or Page Not Found
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          The requested entity key or URL does not exist on the Tiramisu blockchain or has expired. Please verify the entity key.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link href="/" className="btn btn-primary">
            Return to Dashboard
          </Link>
          <Link href="/how-it-works" className="btn btn-secondary">
            How It Works
          </Link>
        </div>
      </div>
    </div>
  );
}
