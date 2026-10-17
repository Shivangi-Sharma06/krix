'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet, PRESET_WALLETS } from './WalletContext';
import { EXPLORER_URL, FAUCET_URL, RPC_URL } from '@/lib/arkiv';
import { isDemoModeActive, getRpcUrls } from '@/lib/config';

export function Header() {
  const {
    address,
    isConnected,
    activeDemoWallet,
    balanceGlm,
    isCorrectNetwork,
    showDemoSwitcher,
    connectMetaMask,
    switchNetwork,
    switchDemoWallet,
    disconnect,
  } = useWallet();

  const [liveBlock, setLiveBlock] = useState<bigint | null>(null);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [activeRpc, setActiveRpc] = useState(RPC_URL);
  const demoMode = isDemoModeActive();

  useEffect(() => {
    let isMounted = true;
    const rpcList = getRpcUrls();

    async function checkChain() {
      for (const rpc of rpcList) {
        try {
          const res = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.result && isMounted) {
              setLiveBlock(BigInt(data.result));
              setRpcStatus('connected');
              setActiveRpc(rpc);
              return;
            }
          }
        } catch {
          // Failover to next RPC in list (Item 8)
        }
      }
      if (isMounted) {
        setRpcStatus('disconnected');
      }
    }

    checkChain();
    const interval = setInterval(checkChain, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {/* Permanent Demo Mode Banner */}
      {demoMode && (
        <div
          style={{
            backgroundColor: 'var(--warning-light)',
            borderBottom: '1px solid var(--warning-border)',
            color: 'var(--warning)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          DEMO MODE - data is simulated locally and is not on the live blockchain
        </div>
      )}

      {/* Wrong Network Warning Banner */}
      {isConnected && !isCorrectNetwork && (
        <div
          style={{
            backgroundColor: 'var(--danger-light)',
            borderBottom: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '500',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span>Wrong Network: Your wallet is not connected to Tiramisu Testnet (ID 7738577).</span>
          <button onClick={switchNetwork} className="btn-secondary" style={{ height: '28px', fontSize: '12px' }}>
            Switch to Tiramisu
          </button>
        </div>
      )}

      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#FFFFFF',
          padding: '12px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <img src="/logo.svg" alt="JanAudit" width="28" height="28" style={{ display: 'block' }} />
              <div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                  JanAudit
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                  Supplies can be delayed. Truth cannot be deleted.
                </div>
              </div>
            </Link>

            <nav style={{ marginLeft: '16px', display: 'flex', gap: '14px', fontSize: '14px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '16px' }}>
              <Link href="/" style={{ color: 'var(--text-main)', fontWeight: '500' }}>
                Records
              </Link>
              <Link href="/new" style={{ color: 'var(--text-main)', fontWeight: '500' }}>
                + New Record
              </Link>
              <Link href="/how-it-works" style={{ color: 'var(--text-main)', fontWeight: '500' }}>
                How It Works
              </Link>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
            {/* Live RPC Status with Tooltip */}
            <div
              title={`Active RPC: ${activeRpc}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'help' }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    rpcStatus === 'connected' ? 'var(--success)' : rpcStatus === 'disconnected' ? 'var(--danger)' : '#888',
                  display: 'inline-block',
                }}
              />
              {rpcStatus === 'connected' ? (
                <span style={{ color: 'var(--text-main)' }}>
                  Live: <strong>Tiramisu (7738577)</strong>, block{' '}
                  <strong style={{ fontFamily: 'monospace' }}>#{liveBlock?.toString() || '...'}</strong>
                </span>
              ) : (
                <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Disconnected</span>
              )}
            </div>

            {/* Faucet Link & Balance */}
            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Bal: </span>
              <strong>{balanceGlm} $GLM</strong>{' '}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--primary)' }}>
                [Faucet]
              </a>
            </div>

            {/* Demo wallet switcher ONLY in demo mode (Item 3) */}
            {showDemoSwitcher && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Demo wallet:</label>
                <select
                  style={{
                    height: '32px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius)',
                    background: '#FFFFFF',
                  }}
                  value={activeDemoWallet ? activeDemoWallet.address : address || ''}
                  onChange={(e) => {
                    const selected = PRESET_WALLETS.find((w) => w.address === e.target.value);
                    if (selected) switchDemoWallet(selected);
                  }}
                >
                  {PRESET_WALLETS.map((w) => (
                    <option key={w.address} value={w.address}>
                      {w.role} ({w.name.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Wallet Connect Button */}
            {isConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    background: '#FFFFFF',
                    padding: '4px 8px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius)',
                    fontSize: '12px',
                  }}
                  title={address || ''}
                >
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                </span>
                <button onClick={disconnect} className="btn-secondary" style={{ height: '32px', padding: '0 8px', fontSize: '12px' }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectMetaMask} className="btn-primary" style={{ height: '32px', fontSize: '12px' }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
