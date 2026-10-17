'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error caught by boundary:', error);
  }, [error]);

  return (
    <div className="container" style={{ paddingTop: '100px', paddingBottom: '100px', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 32px' }}>
        <div className="eyebrow" style={{ color: 'var(--danger)' }}>
          Network or Runtime Issue
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-main)' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          {error.message && !error.message.includes('stack')
            ? error.message
            : 'Unable to communicate with the Tiramisu RPC or load the requested data. Please check your network connection.'}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => reset()} className="btn btn-primary btn-md">
            Try Again
          </button>
          <Link href="/records" className="btn btn-secondary btn-md">
            Return to Records
          </Link>
        </div>
      </div>
    </div>
  );
}
