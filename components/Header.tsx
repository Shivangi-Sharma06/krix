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
  const [navVisible, setNavVisible] = useState(false);

  const demoMode = isDemoModeActive();

  useEffect(() => {
    if (!isLandingPage) {
      setNavVisible(true);
      return;
    }

    const checkVisibility = () => {
      // Must not appear on page load or before user scrolls significantly
      if (typeof window === 'undefined' || window.scrollY < 200) {
        setNavVisible(false);
        return;
      }

      const heroRoles = document.getElementById('hero-roles');
      if (heroRoles) {
        const rect = heroRoles.getBoundingClientRect();
        // Reveal when the hero roles section enters the viewport
        setNavVisible(rect.top <= window.innerHeight * 0.85);
      } else {
        setNavVisible(window.scrollY > window.innerHeight * 0.75);
      }
    };

    setNavVisible(false);
    checkVisibility();
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [isLandingPage]);

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
        transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: navVisible ? 1 : 0,
        pointerEvents: navVisible ? 'auto' : 'none',
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, background-color 0.2s ease, border-color 0.2s ease',
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
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Left: Logo & Brand + Organized Roles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
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

          {/* Active Role Chip if assigned */}
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
                Switch
              </button>
            </div>
          )}

          {/* Navigation Links: Organized Roles & Platform */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '13px',
              marginLeft: '4px',
            }}
            className="nav-desktop"
          >
            {/* Roles Segmented Group */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '2px 3px',
                gap: '2px',
              }}
            >
              <Link
                href="/citizen"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  color: pathname.startsWith('/citizen') ? 'var(--text-main)' : 'var(--text-muted)',
                  backgroundColor: pathname.startsWith('/citizen') ? 'var(--bg-surface-raised)' : 'transparent',
                  fontWeight: pathname.startsWith('/citizen') ? 600 : 500,
                  textDecoration: 'none',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
              >
                Citizen
              </Link>
              <Link
                href="/authority"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  color: pathname.startsWith('/authority') ? 'var(--text-main)' : 'var(--text-muted)',
                  backgroundColor: pathname.startsWith('/authority') ? 'var(--bg-surface-raised)' : 'transparent',
                  fontWeight: pathname.startsWith('/authority') ? 600 : 500,
                  textDecoration: 'none',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
              >
                Authority
              </Link>
            </div>

            <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

            {/* Platform / Ledger Links */}
            <Link
              href="/records"
              style={{
                color: pathname === '/records' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: pathname === '/records' ? 600 : 400,
                textDecoration: 'none',
              }}
            >
              Records
            </Link>
            <Link
              href="/how-it-works"
              style={{
                color: pathname === '/how-it-works' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: pathname === '/how-it-works' ? 600 : 400,
                textDecoration: 'none',
              }}
            >
              How It Works
            </Link>

            {userRole === 'authority' && (
              <Link
                href="/new"
                style={{
                  color: pathname === '/new' ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                + New Promise
              </Link>
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

          {/* Faucet link & balance (when connected) */}
          {balanceGlm !== null && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="mono">
              {parseFloat(balanceGlm).toFixed(3)} $GLM
            </div>
          )}

          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: 'var(--text-faint)', textDecoration: 'none' }}
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
        </div>
      </div>
    </header>
  );
}
