'use client';

import React, { useState, useEffect } from 'react';
import FruitNinjaGame from '@/components/FruitNinjaGame';
import Leaderboard, { LeaderboardEntry } from '@/components/Leaderboard';
import { Wallet, ShieldCheck, Share2, Trophy, Play, Lock, LogOut } from 'lucide-react';

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 Hours Session

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
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'game' | 'leaderboard'>('game');
  const [weeklyScores, setWeeklyScores] = useState<LeaderboardEntry[]>(INITIAL_WEEKLY);
  const [globalScores, setGlobalScores] = useState<LeaderboardEntry[]>(INITIAL_GLOBAL);

  // Check 1-day session & load preserved leaderboard scores
  useEffect(() => {
    // 1. Load persistent leaderboard data safely
    const savedWeekly = localStorage.getItem('fn_weekly_scores');
    const savedGlobal = localStorage.getItem('fn_global_scores');
    if (savedWeekly) setWeeklyScores(JSON.parse(savedWeekly));
    if (savedGlobal) setGlobalScores(JSON.parse(savedGlobal));

    // 2. Validate 1-day session in sessionStorage (expires on tab close or after 24h)
    const sessionWallet = sessionStorage.getItem('fn_session_wallet');
    const sessionExpiry = sessionStorage.getItem('fn_session_expiry');

    if (sessionWallet && sessionExpiry) {
      const expiryTime = parseInt(sessionExpiry, 10);
      if (Date.now() < expiryTime) {
        setWalletAddress(sessionWallet);
      } else {
        // Expired after 1 day
        sessionStorage.removeItem('fn_session_wallet');
        sessionStorage.removeItem('fn_session_expiry');
        setWalletAddress(null);
      }
    }
  }, []);

  const connectBaseWallet = async () => {
    let connectedAddr = '';

    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      try {
        const eth = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          const acc = accounts[0];
          connectedAddr = `${acc.substring(0, 6)}...${acc.substring(acc.length - 4)}`;
        }
      } catch (err) {
        console.error('Wallet connection rejected:', err);
      }
    }

    if (!connectedAddr) {
      // Fallback unique address
      connectedAddr = '0x' + Math.random().toString(16).substring(2, 6) + '...' + Math.random().toString(16).substring(2, 6);
    }

    setWalletAddress(connectedAddr);

    // Save session with 1-day limit in sessionStorage
    sessionStorage.setItem('fn_session_wallet', connectedAddr);
    sessionStorage.setItem('fn_session_expiry', (Date.now() + ONE_DAY_MS).toString());
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    sessionStorage.removeItem('fn_session_wallet');
    sessionStorage.removeItem('fn_session_expiry');
  };

  const handleGameOver = (finalScore: number) => {
    if (finalScore <= 0 || !walletAddress) return;

    const currentAddr = walletAddress;

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

  const shareOnBase = () => {
    const text = encodeURIComponent('🍉 Just sliced fruits in Base Fruit Ninja! Avoided stones and ranked up. Play gasless on Base 👇');
    window.open(`https://warpcast.com/~/compose?text=${text}`, '_blank');
  };

  return (
    <main className="min-h-screen bg-[#0d0b09] text-white flex flex-col items-center justify-start p-3 sm:p-6 selection:bg-amber-500 overflow-y-auto">
      {/* Top Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-3 px-1 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#0052FF] shadow-[0_0_8px_#0052FF]" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase">
            Base Mini App
          </span>
        </div>

        {walletAddress ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-mono bg-[#1c1813] border border-[#3d3226] px-3 py-1.5 rounded-full text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> {walletAddress}
            </div>
            <button
              onClick={disconnectWallet}
              title="Disconnect Wallet"
              className="p-1.5 rounded-full bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectBaseWallet}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#0052FF] hover:bg-[#0045d8] text-white px-3.5 py-1.5 rounded-full transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" /> Connect Base
          </button>
        )}
      </div>

      {/* Gasless Sponsored Badge */}
      <div className="w-full max-w-md bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-3 py-1.5 mb-3 flex items-center justify-between text-[10px] font-mono text-emerald-300">
        <span>⚡ 100% Gasless Gameplay</span>
        <span className="text-emerald-400 font-bold">Sponsored by Developer</span>
      </div>

      {/* Main Mode Switcher */}
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

      {/* View Switch with Wallet Gate */}
      {currentView === 'game' ? (
        walletAddress ? (
          <FruitNinjaGame userAddress={walletAddress} onGameOver={handleGameOver} />
        ) : (
          <div className="w-full max-w-md h-[520px] bg-[#181512] rounded-[32px] border-2 border-[#3d3226] shadow-2xl flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/20 border border-[#0052FF]/50 flex items-center justify-center mb-4 text-[#0052FF] shadow-[0_0_20px_rgba(0,82,255,0.25)]">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Wallet Connection Required</h3>
            <p className="text-xs text-zinc-400 max-w-[260px] mb-6 leading-relaxed">
              Connect your Base Wallet to play. Session lasts 1 day or until you close the tab. Leaderboard ranks stay saved!
            </p>
            <button
              onClick={connectBaseWallet}
              className="w-full max-w-[260px] py-3.5 rounded-2xl bg-[#0052FF] hover:bg-[#0045d8] text-white font-bold text-sm transition-all shadow-[0_0_25px_rgba(0,82,255,0.4)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Connect Base Wallet
            </button>
          </div>
        )
      ) : (
        <Leaderboard
          userAddress={walletAddress || undefined}
          weeklyScores={weeklyScores}
          globalScores={globalScores}
        />
      )}

      {/* Social Feed Share */}
      <div className="w-full max-w-md mt-3 pb-6">
        <button
          onClick={shareOnBase}
          className="w-full py-3 rounded-2xl bg-[#1c1813] hover:bg-[#26201a] border border-[#3d3226] text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
        >
          <Share2 className="w-4 h-4 text-[#0052FF]" /> Share on Base Feed / Warpcast
        </button>
      </div>
    </main>
  );
}