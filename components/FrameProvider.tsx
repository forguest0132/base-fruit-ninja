'use client';

import { useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';

export default function FrameProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (e) {
        console.error('Frame SDK Ready Error:', e);
      }
    };
    init();
  }, []);

  return <>{children}</>;
}