'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import sdk from '@farcaster/frame-sdk';
import FruitNinjaGame from '@/components/FruitNinjaGame';
import Leaderboard, { LeaderboardEntry } from '@/components/Leaderboard';
import { ShieldCheck, Share2, Trophy, Play, Lock, LogOut } from 'lucide-react';

const INITIAL_WEEKLY: LeaderboardEntry[] = [
  { address: '0xBoysun...7f92', score: 480 },
  { address: '0xAlpha...12c4', score: 420 },
  { address: '0xNinja...88e1', score: 395 },
  { address: '0xBaseGod...34a9', score: 310 },
  { address: '0xSamurai...99f0', score: 275 },
];

const INITIAL_GLOBAL: LeaderboardEntry[] = [
  { address: '0xBaseGod...34a9', score: 1250 },
  { address: '0xBoysun...7f92', score: 1120 },
  { address: '0xCyber...44b2', score: 980 },
  { address: '0xAlpha...12c4', score: 850 },
  { address: '0xRonin...00d7', score: 790 },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [currentView, setCurrentView] = useState<'game' | 'leaderboard'>('game');
  const [weeklyScores, setWeeklyScores] = useState<LeaderboardEntry[]>(INITIAL_WEEKLY);
  const [globalScores, setGlobalScores] = useState<LeaderboardEntry[]>(INITIAL_GLOBAL);
  const [farcasterUser, setFarcasterUser] = useState<string | null>(null);

  // Notify Base & Farcaster Mini App container that UI is ready
  useEffect(() => {
    const initSdk = async () => {
      try {
        const context = await sdk.context;
        if (context?.user?.username) {
          setFarcasterUser(`@${context.user.username}`);
        }
        await sdk.actions.ready();
      } catch (err) {
        console.log('Not running in frame context or SDK error', err);
      }
    };
    initSdk();
  }, []);

  const formattedAddress = farcasterUser
    ? farcasterUser
    : address
    ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    : null;

  useEffect(() => {
    const savedWeekly = localStorage.getItem('fn_weekly_scores');
    const savedGlobal = localStorage.getItem('fn_global_scores');
    if (savedWeekly) setWeeklyScores(JSON.parse(savedWeekly));
    if (savedGlobal) setGlobalScores(JSON.parse(savedGlobal));
  }, []);

  const handleGameOver = (finalScore: number) => {
    if (finalScore <= 0 || !formattedAddress) return;

    const currentAddr = formattedAddress;

    const updateScoreList = (prev: LeaderboardEntry[]) => {
      const existingIdx = prev.findIndex(item => item.address.toLowerCase() === currentAddr.toLowerCase());
      let updated = [...prev];

      if (existingIdx >= 0) {
        if (finalScore > updated[existingIdx].score) {
          updated[existingIdx] = { ...updated[existingIdx], score: finalScore, timestamp: Date.now() };
        }
      } else {
        updated.push({ address: currentAddr, score: finalScore, timestamp: Date.now() });
      }

      return updated.sort((a, b) => b.score - a.score);
    };

    setWeeklyScores(prev => {
      const updated = updateScoreList(prev);
      localStorage.setItem('fn_weekly_scores', JSON.stringify(updated));
      return updated;
    });

    setGlobalScores(prev => {
      const updated = updateScoreList(prev);
      localStorage.setItem('fn_global_scores', JSON.stringify(updated));
      return updated;
    });
  };

  const handleConnectBase = () => {
    const coinbaseConnector = connectors.find(c => c.id === 'coinbaseWalletSDK') || connectors[0];
    if (coinbaseConnector) {
      connect({ connector: coinbaseConnector });
    }
  };

  const shareOnBase = () => {
    const text = encodeURIComponent('🍉 Slicing fruits in Base Fruit Ninja! Avoided stones and ranked up. Play gasless on Base 👇');
    try {
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${text}&embeds[]=https://base-fruit-ninja-hazel.vercel.app`);
    } catch {
      window.open(`https://warpcast.com/~/compose?text=${text}&embeds[]=https://base-fruit-ninja-hazel.vercel.app`, '_blank');
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0b09] text-white flex flex-col items-center justify-start p-3 sm:p-6 selection:bg-amber-500 overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-3 px-1 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#0052FF] shadow-[0_0_8px_#0052FF]" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
            Base Mini App
          </span>
        </div>

        {formattedAddress ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono bg-[#1c1813] border border-[#3d3226] px-3 py-1.5 rounded-full text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> {formattedAddress}
            </div>
            {isConnected && (
              <button
                onClick={() => disconnect()}
                title="Disconnect Wallet"
                className="p-1.5 rounded-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleConnectBase}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#0052FF] hover:bg-[#0045d8] text-white px-3.5 py-1.5 rounded-full transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Connect Base
          </button>
        )}
      </div>

      {/* Gasless Badge */}
      <div className="w-full max-w-md bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3 py-1.5 mb-3 flex items-center justify-between text-[10px] font-mono text-emerald-300">
        <span>⚡ 100% Gasless Gameplay</span>
        <span className="text-emerald-400 font-bold">Base Network</span>
      </div>

      {/* Mode Switcher */}
      <div className="w-full max-w-md flex bg-[#1c1813] p-1 rounded-2xl border border-[#3d3226] mb-3 shadow-md">
        <button
          onClick={() => setCurrentView('game')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            currentView === 'game' ? 'bg-[#0052FF] text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Play className="w-3.5 h-3.5" /> Play
        </button>

        <button
          onClick={() => setCurrentView('leaderboard')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            currentView === 'leaderboard' ? 'bg-[#0052FF] text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" /> Leaderboard
        </button>
      </div>

      {/* Main View */}
      {currentView === 'game' ? (
        <FruitNinjaGame userAddress={formattedAddress || 'Player'} onGameOver={handleGameOver} />
      ) : (
        <Leaderboard
          userAddress={formattedAddress || undefined}
          weeklyScores={weeklyScores}
          globalScores={globalScores}
        />
      )}

      {/* Social Share */}
      <div className="w-full max-w-md mt-3 pb-6">
        <button
          onClick={shareOnBase}
          className="w-full py-3 rounded-2xl bg-[#1c1813] hover:bg-[#26201a] border border-[#3d3226] text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <Share2 className="w-4 h-4 text-[#0052FF]" /> Share on Base Feed
        </button>
      </div>
    </main>
  );
}