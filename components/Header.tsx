'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet, PRESET_WALLETS } from './WalletContext';
import { EXPLORER_URL, FAUCET_URL, RPC_URL } from '@/lib/arkiv';
import { isDemoModeActive, getRpcUrls } from '@/lib/config';

export function Header() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  const {
    address,
    isConnected,
    activeDemoWallet,
    balanceGlm,
    isCorrectNetwork,
    showDemoSwitcher,
    userRole,
    setUserRole,
    connectMetaMask,
    switchNetwork,
    switchDemoWallet,
    disconnect,
  } = useWallet();

  const [liveBlock, setLiveBlock] = useState<bigint | null>(null);
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [activeRpc, setActiveRpc] = useState(RPC_URL);
  const [isScrolled, setIsScrolled] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          // Failover to next RPC in list
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        backgroundColor: isScrolled ? 'rgba(20, 19, 17, 0.95)' : 'var(--bg-app)',
        backdropFilter: isScrolled ? 'blur(10px)' : 'none',
        borderBottom: isScrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* 1. Dismissible Announcement Bar (Landing Page only) */}
      {isLandingPage && !announcementDismissed && (
        <aside
          aria-label="Announcement"
          style={{
            backgroundColor: 'var(--bg-surface-raised)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '8px 16px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <span>
            Krix is live on Tiramisu testnet (Chain ID 7738577).{' '}
            <Link
              href="/records"
              style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 500 }}
            >
              Explore real-time records &rarr;
            </Link>
          </span>
          <button
            onClick={() => setAnnouncementDismissed(true)}
            aria-label="Dismiss announcement"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </aside>
      )}

      {/* 2. Demo Mode Warning Banner */}
      {demoMode && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--warning-bg)',
            color: 'var(--warning)',
            borderBottom: '1px solid var(--warning-border)',
            padding: '6px 16px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          DEMO MODE &mdash; data is simulated locally and is not on the live blockchain
        </div>
      )}

      {/* 3. Wrong Network Banner */}
      {isConnected && !isCorrectNetwork && !demoMode && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderBottom: '1px solid var(--danger-border)',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>Wrong network detected. Please switch to Tiramisu Testnet (Chain ID: 7738577).</span>
          <button
            onClick={switchNetwork}
            className="btn btn-secondary btn-md"
            style={{ fontSize: '12px', height: '28px', padding: '0 10px' }}
          >
            Switch Network
          </button>
        </div>
      )}

      {/* 4. Navigation Bar */}
      <div
        style={{
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          padding: isLandingPage ? '14px 24px' : '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Left: Logo & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
          >
            <img
              src="/logo.svg"
              alt="Krix"
              width="26"
              height="26"
              style={{ display: 'block' }}
            />
            <span
              style={{
                fontSize: '19px',
                fontWeight: 600,
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
              }}
            >
              Krix
            </span>
          </Link>

          {/* Active Role Chip in App Shell */}
          {userRole && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className="badge"
                style={{
                  backgroundColor: userRole === 'authority' ? 'var(--accent-soft)' : 'var(--bg-surface-raised)',
                  color: userRole === 'authority' ? 'var(--accent)' : 'var(--text-main)',
                  border: `1px solid ${userRole === 'authority' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                }}
              >
                {userRole === 'authority' ? 'Authority' : 'Citizen'}
              </span>
              <button
                onClick={() => {
                  const nextRole = userRole === 'citizen' ? 'authority' : 'citizen';
                  setUserRole(nextRole);
                }}
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  height: '24px',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
                title="Switch between Citizen and Authority roles"
              >
                Switch role
              </button>
            </div>
          )}

          {/* Navigation Links (Desktop) */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              fontSize: '14px',
              marginLeft: '6px',
            }}
            className="nav-desktop"
          >
            {isLandingPage ? (
              <>
                <a href="#product" style={{ color: 'var(--text-muted)' }}>
                  Product
                </a>
                <a href="#who-its-for" style={{ color: 'var(--text-muted)' }}>
                  Who it&apos;s for
                </a>
                <Link href="/how-it-works" style={{ color: 'var(--text-muted)' }}>
                  How it works
                </Link>
                <Link href="/records" style={{ color: 'var(--text-muted)' }}>
                  Records
                </Link>
                <a href="#faq" style={{ color: 'var(--text-muted)' }}>
                  FAQ
                </a>
              </>
            ) : (
              <>
                <Link
                  href="/citizen"
                  style={{
                    color: pathname.startsWith('/citizen') ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: pathname.startsWith('/citizen') ? 600 : 400,
                  }}
                >
                  Citizen
                </Link>
                <Link
                  href="/party"
                  style={{
                    color: pathname.startsWith('/party') ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: pathname.startsWith('/party') ? 600 : 400,
                  }}
                >
                  Statements
                </Link>
                <Link
                  href="/authority"
                  style={{
                    color: pathname.startsWith('/authority') ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: pathname.startsWith('/authority') ? 600 : 400,
                  }}
                >
                  Authority
                </Link>
                <Link
                  href="/records"
                  style={{
                    color: pathname === '/records' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: pathname === '/records' ? 600 : 400,
                  }}
                >
                  Records
                </Link>
                {userRole === 'authority' && (
                  <Link
                    href="/new"
                    style={{
                      color: pathname === '/new' ? 'var(--text-main)' : 'var(--text-muted)',
                      fontWeight: pathname === '/new' ? 600 : 400,
                    }}
                  >
                    + New Promise
                  </Link>
                )}
                <Link
                  href="/how-it-works"
                  style={{
                    color: pathname === '/how-it-works' ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: pathname === '/how-it-works' ? 600 : 400,
                  }}
                >
                  How It Works
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right: Live Chain Indicator & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Live RPC Status Dot */}
          <div
            title={`RPC: ${activeRpc}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              cursor: 'help',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor:
                  rpcStatus === 'connected'
                    ? 'var(--success)'
                    : rpcStatus === 'disconnected'
                    ? 'var(--danger)'
                    : 'var(--warning)',
                display: 'inline-block',
              }}
            />
            {rpcStatus === 'connected' ? (
              <span className="mono" style={{ display: 'none' }} id="status-text-expanded">
                #{liveBlock?.toString() || '...'}
              </span>
            ) : (
              <span style={{ color: 'var(--danger)' }}>Offline</span>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              Tiramisu {liveBlock ? `#${liveBlock.toString()}` : ''}
            </span>
          </div>

          {/* Landing page role CTAs (Remove generic Open app) */}
          {isLandingPage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href="/citizen"
                className="btn btn-secondary btn-md"
                style={{ fontSize: '13px', height: '32px', padding: '0 12px' }}
              >
                Citizen
              </Link>
              <Link
                href="/authority"
                className="btn btn-primary btn-md"
                style={{ fontSize: '13px', height: '32px', padding: '0 12px' }}
              >
                Authority
              </Link>
            </div>
          ) : (
            <>
              {/* App page: Faucet link & balance */}
              {balanceGlm !== null && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="mono">
                  {parseFloat(balanceGlm).toFixed(3)} $GLM
                </div>
              )}

              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', color: 'var(--text-faint)' }}
              >
                Faucet
              </a>

              {/* Demo Persona Switcher (Only if active) */}
              {showDemoSwitcher && (
                <select
                  value={activeDemoWallet?.address || ''}
                  onChange={(e) => {
                    const match = PRESET_WALLETS.find((w) => w.address.toLowerCase() === e.target.value.toLowerCase());
                    if (match) switchDemoWallet(match);
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    height: '32px',
                    backgroundColor: 'var(--bg-surface-raised)',
                    borderColor: 'var(--border-strong)',
                  }}
                >
                  {PRESET_WALLETS.map((w) => (
                    <option key={w.address} value={w.address}>
                      {w.role} ({w.name.slice(0, 16)}...)
                    </option>
                  ))}
                </select>
              )}

              {/* Wallet Connect / Disconnect */}
              {isConnected ? (
                <button
                  onClick={disconnect}
                  className="btn btn-secondary btn-md mono"
                  title="Click to disconnect"
                  style={{ fontSize: '12px', height: '32px' }}
                >
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                </button>
              ) : (
                <button
                  onClick={connectMetaMask}
                  className="btn btn-primary btn-md"
                  style={{ fontSize: '13px', height: '32px' }}
                >
                  Connect Wallet
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
