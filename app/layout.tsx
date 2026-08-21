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
      <head>
        <meta name="creator:address" content="0x4ECd53055A78bdB5DAfe9ba5154e48906FBe6AEc" />
        <meta name="eth:developer:address" content="0x4ECd53055A78bdB5DAfe9ba5154e48906FBe6AEc" />
        <meta name="base:developer:address" content="0x4ECd53055A78bdB5DAfe9ba5154e48906FBe6AEc" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=620,height=324.76190476190476/event-covers/1b/c2d774-897b-4024-8178-081e6a17b07c" />
        <meta property="fc:frame:button:1" content="Play Fruit Ninja 🍉" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content="https://base-fruit-ninja-hazel.vercel.app" />
      </head>
      <body>
        <OnchainProviders>
          <FrameProvider>{children}</FrameProvider>
        </OnchainProviders>
      </body>
    </html>
  );
}