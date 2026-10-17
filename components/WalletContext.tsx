'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createWalletClient, custom, type Hex } from 'viem';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { getWalletArkivClient } from '@/lib/arkiv';

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
  connectMetaMask: () => Promise<void>;
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
  connectMetaMask: async () => {},
  switchDemoWallet: () => {},
  disconnect: () => {},
  getArkivClient: () => null,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Hex | null>(PRESET_WALLETS[2].address); // Default to Wallet C for demo
  const [activeDemoWallet, setActiveDemoWallet] = useState<DemoWallet | null>(PRESET_WALLETS[2]);
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [balanceGlm, setBalanceGlm] = useState('12.50');

  useEffect(() => {
    // Check if ethereum window is available
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      setIsMetaMask(true);
    }
  }, []);

  const connectMetaMask = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('MetaMask or Web3 wallet extension not detected. Using built-in demo wallet switch.');
      return;
    }
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        setAddress(accounts[0] as Hex);
        setActiveDemoWallet(null);

        // Check & prompt network switch
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x761351' }], // 7738577 in hex
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await ethereum.request({
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
          }
        }
      }
    } catch (err: any) {
      console.error('MetaMask connection error:', err);
      alert('Could not connect MetaMask: ' + err.message);
    }
  };

  const switchDemoWallet = (wallet: DemoWallet) => {
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
    // Return simulated demo client with active address
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
        connectMetaMask,
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
