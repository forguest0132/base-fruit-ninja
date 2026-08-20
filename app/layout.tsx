import type { Metadata } from 'next';
import './globals.css';
import OnchainProviders from '@/components/OnchainProviders';
import FrameProvider from '@/components/FrameProvider';
import '@coinbase/onchainkit/styles.css';

export const metadata: Metadata = {
  title: 'Base Fruit Ninja',
  description: 'Play Fruit Ninja Mini App on Base Network',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OnchainProviders>
          <FrameProvider>{children}</FrameProvider>
        </OnchainProviders>
      </body>
    </html>
  );
}