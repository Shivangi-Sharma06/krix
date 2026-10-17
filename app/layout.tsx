import type { Metadata } from 'next';
import { WalletProvider } from '@/components/WalletContext';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Krix (JanAudit) — Tamper-Evident Civic Audit Layer',
  description: 'Supplies can be delayed. Truth cannot be deleted.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#fff',
          color: '#000',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          lineHeight: 1.5,
        }}
      >
        <WalletProvider>
          <Header />
          <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
