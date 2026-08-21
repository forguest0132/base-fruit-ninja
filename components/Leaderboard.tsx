'use client';

import React, { useState } from 'react';

export interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
}

interface LeaderboardProps {
  userAddress?: string;
  allScores: LeaderboardEntry[];
}

export default function Leaderboard({ userAddress, allScores }: LeaderboardProps) {
  const [tab, setTab] = useState<'weekly' | 'allTime'>('weekly');

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // ৭ দিনের ফিল্টার (Weekly Filter)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Tab অনুযায়ী ফিল্টার ও সর্টিং
  const filteredList = (tab === 'weekly'
    ? allScores.filter((item) => item.timestamp >= oneWeekAgo)
    : allScores
  ).sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-lg text-slate-100 flex items-center gap-2">
          <span>🏆</span> Leaderboard
        </h3>

        {/* Weekly vs All-Time Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('weekly')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              tab === 'weekly' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setTab('allTime')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
              tab === 'allTime' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* Rewards Notice */}
      <div className="mb-4 p-2.5 bg-blue-950/40 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs">
        <span className="text-blue-300 font-medium">Weekly Prize Pool:</span>
        <span className="font-black text-amber-300 font-mono">$6 USDC Rewards</span>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {filteredList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 font-medium">
            No scores recorded yet this week. Be the first! 🍉
          </div>
        ) : (
          filteredList.map((entry, index) => {
            const isUser = userAddress && entry.address.toLowerCase() === userAddress.toLowerCase();
            return (
              <div
                key={`${entry.address}-${index}`}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                  isUser
                    ? 'bg-blue-600/10 border-blue-500/40 text-blue-200'
                    : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      index === 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : index === 1
                        ? 'bg-slate-400/20 text-slate-200 border border-slate-400/30'
                        : index === 2
                        ? 'bg-amber-700/20 text-amber-400 border border-amber-700/30'
                        : 'text-slate-500 font-mono'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {formatAddress(entry.address)}
                    {isUser && <span className="ml-1.5 text-[10px] text-blue-400 font-sans font-bold">(You)</span>}
                  </span>
                </div>
                <span className="font-mono font-black text-sm text-slate-100">{entry.score} pts</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}