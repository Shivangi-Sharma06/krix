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
    <div className="container" style={{ paddingTop: '80px', paddingBottom: '80px', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '560px', margin: '0 auto', padding: '36px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Network or Runtime Issue
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text)' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
          {error.message && !error.message.includes('stack')
            ? error.message
            : 'Unable to communicate with the Tiramisu RPC or load the requested data. Please check your network connection.'}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={() => reset()} className="btn btn-primary">
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
