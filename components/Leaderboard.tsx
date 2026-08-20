'use client';

import React, { useState } from 'react';
import { Calendar, Globe, Clock, Trophy, Users } from 'lucide-react';

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

  // Sort descending by score and calculate dynamic ranks
  const sortedList = [...rawList]
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

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
          <Calendar className="w-3.5 h-3.5" /> Weekly Leaderboard
        </button>

        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'global' ? 'bg-[#0052FF] text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Global Leaderboard
        </button>
      </div>

      {/* Weekly Countdown Notice */}
      {activeTab === 'weekly' && (
        <div className="flex items-center justify-between text-[10px] text-amber-300/80 bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-900/40 mb-3 font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" /> Resets every Monday 12:00 AM UTC
          </span>
          <span className="font-bold text-amber-400">ACTIVE</span>
        </div>
      )}

      {/* Dynamic Scrollable List for All Players */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {sortedList.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs font-mono">
            No entries yet. Play a game to set the first score!
          </div>
        ) : (
          sortedList.map(player => {
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
                    ? 'bg-[#0052FF]/15 border-[#0052FF]/60 shadow-[0_0_12px_rgba(0,82,255,0.2)]'
                    : 'bg-[#221c17]/70 border-[#382d20] hover:border-[#4d3e2b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center font-mono font-black text-sm ${badgeColor}`}>
                    #{player.rank}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-zinc-200">
                      {player.address}
                      {isCurrentUser && (
                        <span className="ml-2 text-[9px] bg-[#0052FF] text-white px-1.5 py-0.2 rounded font-sans">
                          YOU
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="font-mono font-bold text-xs text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-900/50">
                  {player.score} PTS
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}