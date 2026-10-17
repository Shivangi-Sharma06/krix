'use client';

import React from 'react';
import Link from 'next/link';
import { useWallet, PRESET_WALLETS } from './WalletContext';
import { EXPLORER_URL, FAUCET_URL } from '@/lib/arkiv';

export function Header() {
  const { address, isConnected, activeDemoWallet, balanceGlm, connectMetaMask, switchDemoWallet, disconnect } =
    useWallet();

  return (
    <header
      style={{
        borderBottom: '1px solid #ccc',
        padding: '12px 16px',
        backgroundColor: '#fff',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: '#000', fontWeight: 'bold', fontSize: '18px' }}>
          Krix (JanAudit)
        </Link>
        <span style={{ fontSize: '12px', color: '#666', borderLeft: '1px solid #ddd', paddingLeft: '12px' }}>
          Network: <strong>Tiramisu (7738577)</strong>
        </span>
        <Link href="/new" style={{ fontSize: '13px', color: '#000', textDecoration: 'underline' }}>
          + New Civic Record
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
        <div>
          <span>Balance: </span>
          <strong>{balanceGlm} $GLM</strong>{' '}
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#0066cc', marginLeft: '4px' }}
          >
            [Faucet]
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: '#555' }}>Demo Role:</label>
          <select
            style={{
              padding: '4px 6px',
              fontSize: '12px',
              border: '1px solid #999',
              background: '#fff',
            }}
            value={activeDemoWallet ? activeDemoWallet.address : address || ''}
            onChange={(e) => {
              const selected = PRESET_WALLETS.find((w) => w.address === e.target.value);
              if (selected) switchDemoWallet(selected);
            }}
          >
            {PRESET_WALLETS.map((w) => (
              <option key={w.address} value={w.address}>
                {w.role} ({w.name})
              </option>
            ))}
          </select>
        </div>

        {isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                background: '#f4f4f4',
                padding: '4px 8px',
                border: '1px solid #ccc',
              }}
              title={address || ''}
            >
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </span>
            <button
              onClick={disconnect}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                background: '#eee',
                border: '1px solid #999',
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connectMetaMask}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              background: '#000',
              color: '#fff',
              border: 'none',
            }}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
