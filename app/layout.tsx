import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/components/WalletContext';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'JanAudit — Tamper-Evident Civic Audit Layer',
  description: 'Supplies can be delayed. Truth cannot be deleted. Built on Arkiv & Tiramisu testnet.',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        <WalletProvider>
          <Header />
          <main style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '24px 24px 60px' }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
