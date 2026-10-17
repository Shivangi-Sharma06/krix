'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: '100px', paddingBottom: '100px', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '520px', margin: '0 auto', padding: '40px 32px' }}>
        <div className="eyebrow" style={{ color: 'var(--text-faint)' }}>
          404 &middot; Not Found
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-main)' }}>
          Record or Page Not Found
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          The requested entity key or URL does not exist on the Tiramisu blockchain or has expired. Please verify the entity key.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link href="/records" className="btn btn-primary btn-md">
            Return to Records
          </Link>
          <Link href="/how-it-works" className="btn btn-secondary btn-md">
            How It Works
          </Link>
        </div>
      </div>
    </div>
  );
}
