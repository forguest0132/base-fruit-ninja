'use client';

import React, { ReactNode } from 'react';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'Base Fruit Ninja',
      preference: 'all',
    }),
    injected(),
  ],
  ssr: true,
  transports: {
    [base.id]: http(),
  },
});

export default function OnchainProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}