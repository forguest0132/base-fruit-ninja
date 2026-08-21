'use client';

import React, { useState } from 'react';
import { Calendar, Globe, Clock, Trophy, Users, UserCheck } from 'lucide-react';

export interface LeaderboardEntry {
  rank?: number;
  address: string;
  score: number;
  timestamp?: number;
}

interface LeaderboardProps {
  userAddress?: string;
  weeklyScores: LeaderboardEntry[];
  globalScores: LeaderboardEntry[];
}

export default function Leaderboard({ userAddress, weeklyScores, globalScores }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'global'>('weekly');
  const rawList = activeTab === 'weekly' ? weeklyScores : globalScores;

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-6)}`;
  };

  // Check if current user is present, if not add with 0 pts
  let displayList = [...rawList];
  if (userAddress && !displayList.some((item) => item.address.toLowerCase() === userAddress.toLowerCase())) {
    displayList.push({ address: userAddress, score: 0, timestamp: Date.now() });
  }

  // Sort descending by score and compute rank
  const sortedList = displayList
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const currentUserEntry = userAddress
    ? sortedList.find((item) => item.address.toLowerCase() === userAddress.toLowerCase())
    : null;

  return (
    <div className="w-full max-w-md bg-[#181512]/95 backdrop-blur-md rounded-[28px] p-4 sm:p-5 border border-[#3d3226] shadow-2xl text-white my-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="font-black text-base tracking-wide text-zinc-100 uppercase font-mono">
            Leaderboard
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono bg-[#2a2219] text-amber-400 border border-amber-900/50 px-2.5 py-0.5 rounded-full">
          <Users className="w-3 h-3" />
          <span>{sortedList.length} Players</span>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-[#26201a] p-1 rounded-2xl border border-[#3d3226] mb-3">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'weekly' ? 'bg-[#0052FF] text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Weekly
        </button>

        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'global' ? 'bg-[#0052FF] text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Global (All Time)
        </button>
      </div>

      {/* Countdown Reset Notice */}
      <div className="flex items-center justify-between text-[10px] text-amber-300/80 bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-900/40 mb-3 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          {activeTab === 'weekly' ? 'Resets Mondays 12:00 AM UTC' : 'Permanent All-Time Rankings'}
        </span>
        <span className="font-bold text-amber-400">ACTIVE</span>
      </div>

      {/* Persistent Current User Card */}
      {currentUserEntry && (
        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-[#0052FF]/25 to-transparent border border-[#0052FF]/60 flex items-center justify-between shadow-[0_0_15px_rgba(0,82,255,0.15)]">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-[#38bdf8]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Your Standing</span>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                {formatAddress(currentUserEntry.address)}
                <span className="text-[9px] bg-[#0052FF] text-white px-1.5 py-0.5 rounded font-sans">YOU</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-zinc-400">#{currentUserEntry.rank}</span>
            <span className="font-bold text-xs text-amber-400 bg-amber-950/70 px-2 py-1 rounded-lg border border-amber-900/60">
              {currentUserEntry.score} PTS
            </span>
          </div>
        </div>
      )}

      {/* Scrollable Leaderboard List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {sortedList.map((player) => {
          const isCurrentUser = userAddress && player.address.toLowerCase() === userAddress.toLowerCase();

          let badgeColor = 'text-zinc-400';
          if (player.rank === 1) badgeColor = 'text-amber-400 font-bold';
          if (player.rank === 2) badgeColor = 'text-slate-300 font-bold';
          if (player.rank === 3) badgeColor = 'text-amber-600 font-bold';

          return (
            <div
              key={`${player.address}-${player.rank}`}
              className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                isCurrentUser
                  ? 'bg-[#0052FF]/20 border-[#0052FF] shadow-[0_0_12px_rgba(0,82,255,0.25)]'
                  : 'bg-[#221c17]/70 border-[#382d20] hover:border-[#4d3e2b]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-mono font-black text-sm ${badgeColor}`}>
                  #{player.rank}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-200">{formatAddress(player.address)}</span>
                  {isCurrentUser && (
                    <span className="text-[9px] bg-[#0052FF] text-white px-1.5 py-0.5 rounded font-sans">
                      YOU
                    </span>
                  )}
                </div>
              </div>

              <div className="font-mono font-bold text-xs text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-900/50">
                {player.score} PTS
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}