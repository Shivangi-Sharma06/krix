'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { type Hex, isAddress, getAddress } from 'viem';
import { getWalletArkivClient } from '@/lib/arkiv';
import { isDemoModeActive } from '@/lib/config';

export interface DemoWallet {
  name: string;
  role: string;
  address: Hex;
}

export const PRESET_WALLETS: DemoWallet[] = [
  {
    name: 'State Warehouse Officer (Wallet A)',
    role: 'Warehouse Custodian',
    address: '0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A01',
  },
  {
    name: 'Distributor / Truck (Wallet B)',
    role: 'Transit Custodian',
    address: '0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A012B',
  },
  {
    name: 'Clinic Officer (Wallet C)',
    role: 'Clinic Receiver',
    address: '0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0123C4',
  },
  {
    name: 'Dr. Rao (PHC Doctor)',
    role: 'Field Doctor',
    address: '0x4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A012345D6',
  },
  {
    name: 'District Health Inspector',
    role: 'Inspector',
    address: '0x5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A01234567E8',
  },
  {
    name: 'Citizen Auditor',
    role: 'Resident Citizen',
    address: '0x6F7A8B9C0D1E2F3A4B5C6D7E8F9A0123456789F0',
  },
];

interface WalletContextType {
  address: Hex | null;
  isConnected: boolean;
  isMetaMask: boolean;
  activeDemoWallet: DemoWallet | null;
  balanceGlm: string;
  isCorrectNetwork: boolean;
  showDemoSwitcher: boolean;
  connectMetaMask: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  switchDemoWallet: (wallet: DemoWallet) => void;
  disconnect: () => void;
  getArkivClient: () => any;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isMetaMask: false,
  activeDemoWallet: null,
  balanceGlm: '0.00',
  isCorrectNetwork: true,
  showDemoSwitcher: false,
  connectMetaMask: async () => {},
  switchNetwork: async () => {},
  switchDemoWallet: () => {},
  disconnect: () => {},
  getArkivClient: () => null,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Hex | null>(null);
  const [activeDemoWallet, setActiveDemoWallet] = useState<DemoWallet | null>(null);
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [balanceGlm, setBalanceGlm] = useState('0.00');
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [showDemoSwitcher, setShowDemoSwitcher] = useState(false);

  useEffect(() => {
    const demoMode = isDemoModeActive();
    setShowDemoSwitcher(demoMode);

    if (demoMode && !address) {
      setAddress(PRESET_WALLETS[2].address);
      setActiveDemoWallet(PRESET_WALLETS[2]);
      setBalanceGlm('12.50');
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      setIsMetaMask(true);
      const ethereum = (window as any).ethereum;

      // Listen for account and chain change events (Item 8)
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0] as Hex);
          setActiveDemoWallet(null);
        } else {
          setAddress(null);
          setActiveDemoWallet(null);
        }
      };

      const handleChainChanged = (chainId: string) => {
        const isTiramisu = chainId === '0x761351' || chainId === '7738577';
        setIsCorrectNetwork(isTiramisu);
      };

      ethereum.on?.('accountsChanged', handleAccountsChanged);
      ethereum.on?.('chainChanged', handleChainChanged);

      // Check current chain
      ethereum.request?.({ method: 'eth_chainId' }).then((chainId: string) => {
        setIsCorrectNetwork(chainId === '0x761351' || chainId === '7738577');
      }).catch(() => {});

      return () => {
        ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const switchNetwork = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const provider = (window as any).ethereum;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x761351' }],
      });
      setIsCorrectNetwork(true);
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x761351',
              chainName: 'Tiramisu Testnet',
              rpcUrls: ['https://rpc.tiramisu.db-chain.testnet.arkiv.network'],
              nativeCurrency: { name: 'Golem', symbol: 'GLM', decimals: 18 },
              blockExplorerUrls: ['https://tiramisu.explorer.arkiv.network'],
            },
          ],
        });
        setIsCorrectNetwork(true);
      }
    }
  };

  const connectMetaMask = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    try {
      let provider = (window as any).ethereum;
      if (provider?.providers?.length) {
        provider = provider.providers.find((p: any) => p.isMetaMask) || provider.providers[0];
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        setAddress(accounts[0] as Hex);
        setActiveDemoWallet(null);
        await switchNetwork();
      }
    } catch (err: any) {
      if (err?.code !== 4001) {
        console.error('MetaMask connection error:', err);
      }
    }
  };

  const switchDemoWallet = (wallet: DemoWallet) => {
    if (!showDemoSwitcher) return;
    setAddress(wallet.address);
    setActiveDemoWallet(wallet);
  };

  const disconnect = () => {
    setAddress(null);
    setActiveDemoWallet(null);
  };

  const getArkivClient = () => {
    if (typeof window !== 'undefined' && (window as any).ethereum && !activeDemoWallet) {
      return getWalletArkivClient((window as any).ethereum);
    }
    return {
      account: { address: address || PRESET_WALLETS[0].address },
      createEntity: async () => {
        throw new Error('Simulation fallback');
      },
      patchEntity: async () => {
        throw new Error('Simulation fallback');
      },
      changeOwnership: async () => {
        throw new Error('Simulation fallback');
      },
      extendEntity: async () => {
        throw new Error('Simulation fallback');
      },
    };
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isMetaMask,
        activeDemoWallet,
        balanceGlm,
        isCorrectNetwork,
        showDemoSwitcher,
        connectMetaMask,
        switchNetwork,
        switchDemoWallet,
        disconnect,
        getArkivClient,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
