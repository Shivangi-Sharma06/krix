import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().default(7738577),
  NEXT_PUBLIC_RPC_URL: z.string().url().default('https://rpc.tiramisu.db-chain.testnet.arkiv.network'),
  NEXT_PUBLIC_RPC_URLS: z.string().optional().default('https://rpc.tiramisu.db-chain.testnet.arkiv.network'),
  NEXT_PUBLIC_EXPLORER_URL: z.string().url().default('https://tiramisu.explorer.arkiv.network'),
  NEXT_PUBLIC_FAUCET_URL: z.string().url().default('https://hub.arkiv.network/faucet'),
  NEXT_PUBLIC_IPFS_GATEWAY: z.string().url().default('https://ipfs.io/ipfs/'),
  NEXT_PUBLIC_IPFS_GATEWAYS: z.string().optional().default('https://ipfs.io/ipfs/,https://gateway.pinata.cloud/ipfs/,https://cloudflare-ipfs.com/ipfs/'),
  NEXT_PUBLIC_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_ALLOW_DEMO_IN_PROD: z.enum(['true', 'false']).default('false'),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_RPC_URLS: process.env.NEXT_PUBLIC_RPC_URLS,
  NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL,
  NEXT_PUBLIC_FAUCET_URL: process.env.NEXT_PUBLIC_FAUCET_URL,
  NEXT_PUBLIC_IPFS_GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY,
  NEXT_PUBLIC_IPFS_GATEWAYS: process.env.NEXT_PUBLIC_IPFS_GATEWAYS,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  NEXT_PUBLIC_ALLOW_DEMO_IN_PROD: process.env.NEXT_PUBLIC_ALLOW_DEMO_IN_PROD,
});

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.format())}`);
}

export const envConfig = parsed.data;

/**
 * Demo Mode is strictly disabled in production builds (NODE_ENV === 'production')
 * unless NEXT_PUBLIC_ALLOW_DEMO_IN_PROD=true is explicitly set. (Item 3)
 */
export const isDemoModeActive = (): boolean => {
  const isDemo = envConfig.NEXT_PUBLIC_DEMO_MODE === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return isDemo && envConfig.NEXT_PUBLIC_ALLOW_DEMO_IN_PROD === 'true';
  }
  return isDemo;
};

export const getRpcUrls = (): string[] => {
  const list = envConfig.NEXT_PUBLIC_RPC_URLS.split(',').map((u) => u.trim()).filter(Boolean);
  if (list.length === 0) list.push(envConfig.NEXT_PUBLIC_RPC_URL);
  return list;
};

export const getIpfsGateways = (): string[] => {
  const list = envConfig.NEXT_PUBLIC_IPFS_GATEWAYS.split(',').map((u) => u.trim()).filter(Boolean);
  if (list.length === 0) list.push(envConfig.NEXT_PUBLIC_IPFS_GATEWAY);
  return list;
};
