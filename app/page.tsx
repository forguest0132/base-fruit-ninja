'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

const CONTRACT_ADDRESS = '0xd807742953d3cB55334f53495B5a3b08837c342E';
const BUILDER_WALLET = '0x4ECd53055A78bdB5DAfe9ba5154e48906FBe6AEc'.toLowerCase();

const SESSION_ABI = [
  {
    type: 'function',
    name: 'startSession',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordScore',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_score', type: 'uint256' }],
    outputs: [],
  },
] as const;

interface FruitItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  isBomb: boolean;
  isStone: boolean;
  sliced: boolean;
  missed?: boolean;
}

interface LeaderboardEntry {
  address: string;
  score: number;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [mounted, setMounted] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [fruits, setFruits] = useState<FruitItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const gameAreaRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const livesRef = useRef(3);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Web Audio Synthesizer
  const playSound = (type: 'slice' | 'bomb' | 'miss' | 'stone' | 'over') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      if (type === 'slice') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'stone') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'bomb') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'miss') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'over') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.45);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch {
      // Audio safety
    }
  };

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-6)}`;
  };

  useEffect(() => {
    const savedLb = localStorage.getItem('base_ninja_leaderboard');
    if (savedLb) {
      try {
        setLeaderboard(JSON.parse(savedLb));
      } catch {
        setLeaderboard([]);
      }
    }
    if (address) {
      const saved = localStorage.getItem(`highScore_${address.toLowerCase()}`);
      if (saved) setHighScore(parseInt(saved, 10));
    }
  }, [address]);

  useEffect(() => {
    if (!isConnected || !address) {
      setIsSessionActive(false);
      return;
    }
    if (address.toLowerCase() === BUILDER_WALLET) {
      setIsSessionActive(true);
      return;
    }
    const savedSession = sessionStorage.getItem(`session_${address.toLowerCase()}`);
    setIsSessionActive(savedSession === 'active');
  }, [address, isConnected]);

  useEffect(() => {
    if (isConfirmed && address) {
      sessionStorage.setItem(`session_${address.toLowerCase()}`, 'active');
      setIsSessionActive(true);
    }
  }, [isConfirmed, address]);

  const handleStartSession = () => {
    if (address?.toLowerCase() === BUILDER_WALLET) {
      setIsSessionActive(true);
      return;
    }
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: SESSION_ABI,
      functionName: 'startSession',
    });
  };

  // Connect Handler with multi-fallback
  const handleConnectWallet = async () => {
    // 1. Try injected connector from wagmi
    const injected = connectors.find((c) => c.id === 'injected') || connectors[0];
    if (injected) {
      try {
        connect({ connector: injected });
        return;
      } catch (e) {
        console.warn('Wagmi connect attempt failed:', e);
      }
    }

    // 2. Direct window.ethereum fallback for Rabby / Metamask
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum) {
      try {
        await (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<unknown> } }).ethereum.request({
          method: 'eth_requestAccounts',
        });
      } catch (err) {
        console.error('Direct window.ethereum request failed:', err);
      }
    }
  };

  const handleDisconnect = () => {
    if (address) {
      sessionStorage.removeItem(`session_${address.toLowerCase()}`);
    }
    setIsSessionActive(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    disconnect();
  };

  const startGame = () => {
    setScore(0);
    setLives(3);
    livesRef.current = 3;
    setGameOver(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    setFruits([]);
    setTrail([]);
  };

  const triggerGameOver = () => {
    playSound('over');
    setGameOver(true);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setLives(0);
    livesRef.current = 0;
  };

  const deductLife = () => {
    const remaining = livesRef.current - 1;
    livesRef.current = remaining;
    setLives(remaining);
    if (remaining <= 0) {
      triggerGameOver();
      return false;
    }
    return true;
  };

  // Game Loop
  useEffect(() => {
    if (!isPlaying) return;

    const spawnInterval = setInterval(() => {
      if (!isPlayingRef.current) return;
      const rand = Math.random();
      const isBomb = rand < 0.15;
      const isStone = !isBomb && rand < 0.35;

      const emojis = ['🍉', '🍎', '🍌', '🍍', '🍓', '🍊', '🍇'];
      let emoji = emojis[Math.floor(Math.random() * emojis.length)];
      if (isBomb) emoji = '💣';
      if (isStone) emoji = '🪨';

      const newFruit: FruitItem = {
        id: Date.now() + Math.random(),
        x: Math.random() * 260 + 20,
        y: 380,
        vx: (Math.random() - 0.5) * 3.5,
        vy: -(Math.random() * 3.5 + 9.5),
        emoji,
        isBomb,
        isStone,
        sliced: false,
        missed: false,
      };

      setFruits((prev) => [...prev, newFruit]);
    }, 850);

    const updatePhysics = () => {
      if (!isPlayingRef.current) return;

      setFruits((prev) => {
        const nextFruits: FruitItem[] = [];

        for (const f of prev) {
          const nextY = f.y + f.vy;
          const nextX = f.x + f.vx;
          const nextVy = f.vy + 0.2;

          // Only missed fruits deduct a life
          if (nextY > 390 && !f.sliced && !f.missed) {
            if (!f.isBomb && !f.isStone) {
              playSound('miss');
              const alive = deductLife();
              if (!alive) return [];
            }
            f.missed = true;
          }

          if (nextY < 430) {
            nextFruits.push({
              ...f,
              x: nextX,
              y: nextY,
              vy: nextVy,
            });
          }
        }
        return nextFruits;
      });

      if (isPlayingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updatePhysics);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      clearInterval(spawnInterval);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  // Update Leaderboard on Game Over
  useEffect(() => {
    if (gameOver && address && score > 0) {
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem(`highScore_${address.toLowerCase()}`, score.toString());
      }

      setLeaderboard((prev) => {
        const existingIndex = prev.findIndex((e) => e.address.toLowerCase() === address.toLowerCase());
        let updated = [...prev];
        if (existingIndex >= 0) {
          if (score > updated[existingIndex].score) {
            updated[existingIndex].score = score;
          }
        } else {
          updated.push({ address, score });
        }
        updated.sort((a, b) => b.score - a.score);
        updated = updated.slice(0, 5);
        localStorage.setItem('base_ninja_leaderboard', JSON.stringify(updated));
        return updated;
      });
    }
  }, [gameOver, score, highScore, address]);

  // Slicing Logic
  const handleSlice = (clientX: number, clientY: number) => {
    if (!gameAreaRef.current || !isPlayingRef.current) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const slashX = clientX - rect.left;
    const slashY = clientY - rect.top;

    setTrail((prev) => [...prev.slice(-14), { x: slashX, y: slashY, id: Math.random() }]);

    setFruits((prev) =>
      prev.map((f) => {
        if (!f.sliced) {
          const distX = Math.abs(f.x + 20 - slashX);
          const distY = Math.abs(f.y + 20 - slashY);

          if (distX < 38 && distY < 38) {
            if (f.isBomb) {
              playSound('bomb');
              triggerGameOver();
            } else if (f.isStone) {
              playSound('stone');
              deductLife();
            } else {
              playSound('slice');
              setScore((s) => s + 1);
            }
            return { ...f, sliced: true };
          }
        }
        return f;
      })
    );
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center py-2.5 px-4 bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-black text-sm tracking-wide text-slate-200">BASE NINJA</span>
        </div>
        <div>
          {isConnected && address ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-800 text-blue-400 font-mono px-2.5 py-1 rounded-full border border-blue-500/30">
                {formatAddress(address)}
              </span>
              {address.toLowerCase() === BUILDER_WALLET && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/40">
                  BUILDER
                </span>
              )}
              <button
                onClick={handleDisconnect}
                className="text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white font-bold px-2 py-0.5 rounded-lg border border-rose-500/30 transition cursor-pointer"
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-xl font-bold transition shadow-sm cursor-pointer"
            >
              Connect
            </button>
          )}
        </div>
      </header>

      {/* Main Game Interface */}
      <div className="w-full max-w-md my-auto flex flex-col items-center gap-4">
        {!isConnected ? (
          <div className="w-full p-8 bg-slate-900/90 rounded-3xl border border-slate-800 text-center shadow-2xl">
            <span className="text-5xl">🍉</span>
            <h1 className="text-2xl font-black mt-4 text-slate-100">Base Fruit Ninja</h1>
            <p className="text-xs text-slate-400 mt-2 mb-6">Connect your Base wallet to slice fruits and climb the rank.</p>
            <button
              onClick={handleConnectWallet}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              Connect Wallet 🔵
            </button>
          </div>
        ) : !isSessionActive ? (
          <div className="w-full p-8 bg-slate-900/90 rounded-3xl border border-slate-800 text-center shadow-2xl">
            <span className="text-5xl">🎟️</span>
            <h2 className="text-xl font-bold mt-4 text-slate-100">Start Onchain Session</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
              Create an onchain session on Base. 0 ETH fee (micro gas applies). Play unlimited rounds during this session!
            </p>
            <button
              onClick={handleStartSession}
              disabled={isPending || isConfirming}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? 'Check Wallet...' : isConfirming ? 'Creating Session...' : 'Start Session 🔵'}
            </button>
          </div>
        ) : (
          <div className="w-full relative bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center">
            {/* Top Score Bar */}
            <div className="w-full flex justify-between items-center p-4 bg-slate-950/40 border-b border-slate-800/60">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{score}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Lives</span>
                <div className="flex gap-1.5 text-base mt-0.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={`transition-opacity duration-200 ${i < lives ? 'opacity-100 scale-100' : 'opacity-25 grayscale scale-90'}`}>
                      ❤️
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Best</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{highScore}</span>
              </div>
            </div>

            {/* Slicing Canvas */}
            <div
              ref={gameAreaRef}
              onMouseMove={(e) => handleSlice(e.clientX, e.clientY)}
              onTouchMove={(e) => {
                if (e.touches[0]) handleSlice(e.touches[0].clientX, e.touches[0].clientY);
              }}
              className="relative w-full h-[390px] bg-gradient-to-b from-slate-950/40 to-slate-900/60 flex items-center justify-center overflow-hidden select-none cursor-crosshair touch-none"
            >
              {/* Blade Slash Trail */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {trail.map((point, index) => {
                  if (index === 0) return null;
                  const prev = trail[index - 1];
                  return (
                    <line
                      key={point.id}
                      x1={prev.x}
                      y1={prev.y}
                      x2={point.x}
                      y2={point.y}
                      stroke="#38bdf8"
                      strokeWidth={Math.max(2, index * 0.8)}
                      strokeLinecap="round"
                      opacity={index / trail.length}
                    />
                  );
                })}
              </svg>

              {!isPlaying && !gameOver && (
                <div className="text-center p-6 flex flex-col items-center z-20">
                  <span className="text-6xl mb-3 animate-bounce">⚔️</span>
                  <h3 className="text-xl font-black text-slate-100">Ready to Slice?</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-6">
                    Slice fruits! Hit 🪨 Stone = -1 Life. Hit 💣 Bomb = Game Over!
                  </p>
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    Play Now 🍉
                  </button>
                </div>
              )}

              {gameOver && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-5xl mb-2">💥</span>
                  <h3 className="text-2xl font-black text-red-400">Game Over</h3>
                  <p className="text-sm text-slate-300 mt-1">Final Score: <span className="font-bold text-blue-400 font-mono">{score}</span></p>
                  <p className="text-xs text-slate-400 mb-6">Personal Best: <span className="font-bold text-amber-400 font-mono">{highScore}</span></p>
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    Play Again 🔄
                  </button>
                </div>
              )}

              {/* Items */}
              {fruits.map((f) => (
                <div
                  key={f.id}
                  style={{
                    transform: `translate(${f.x}px, ${f.y}px)`,
                    opacity: f.sliced ? 0 : 1,
                    transition: f.sliced ? 'opacity 0.15s ease-out' : 'none',
                  }}
                  className="absolute text-4xl select-none pointer-events-none"
                >
                  {f.emoji}
                </div>
              ))}
            </div>

            {/* Leaderboard Panel */}
            <div className="w-full bg-slate-950/60 p-4 border-t border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">🏆 Top Onchain Ninjas</span>
                <span className="text-[10px] text-blue-400 font-mono">Base Network</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {leaderboard.length === 0 ? (
                  <span className="text-xs text-slate-600 text-center py-2">No scores recorded yet. Be the first!</span>
                ) : (
                  leaderboard.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                          #{idx + 1}
                        </span>
                        <span className="text-slate-300">{formatAddress(item.address)}</span>
                      </div>
                      <span className="font-bold text-blue-400">{item.score} pts</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md flex flex-col items-center gap-1 py-2 text-center">
        <span className="text-[11px] text-slate-400">
          Built on <span className="text-blue-400 font-semibold">Base</span> by{' '}
          <a
            href="https://warpcast.com/0xboysun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 font-semibold underline hover:text-blue-400 transition"
          >
            0xboysun
          </a>
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          Contract: {formatAddress(CONTRACT_ADDRESS)}
        </span>
      </footer>
    </main>
  );
}