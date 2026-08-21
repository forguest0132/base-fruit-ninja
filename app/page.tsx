'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import Leaderboard, { LeaderboardEntry } from '@/components/Leaderboard';
import { supabase } from '@/lib/supabase';

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

interface GameObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  emoji: string;
  isBomb: boolean;
  isStone: boolean;
  sliced: boolean;
  missed: boolean;
  radius: number;
  leftPiece?: { x: number; y: number; vx: number; vy: number; rot: number };
  rightPiece?: { x: number; y: number; vx: number; vy: number; rot: number };
}

export default function Home() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [directAddress, setDirectAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const gameStateRef = useRef({
    isPlaying: false,
    score: 0,
    lives: 3,
    highScore: 0,
    objects: [] as GameObject[],
    trail: [] as { x: number; y: number; age: number }[],
    lastSpawn: 0,
    spawnInterval: 900,
  });

  const activeAddress = wagmiAddress || directAddress;
  const isUserConnected = wagmiConnected || !!directAddress;

  const fetchGlobalLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('address, score, created_at')
        .order('score', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        return;
      }

      if (data) {
        const userBestMap = new Map<string, { address: string; score: number; timestamp: number }>();

        data.forEach((item: any) => {
          const addrKey = item.address.toLowerCase();
          const timestamp = new Date(item.created_at).getTime();
          if (!userBestMap.has(addrKey) || userBestMap.get(addrKey)!.score < item.score) {
            userBestMap.set(addrKey, {
              address: item.address,
              score: item.score,
              timestamp,
            });
          }
        });

        const formatted = Array.from(userBestMap.values()).sort((a, b) => b.score - a.score);
        setLeaderboard(formatted);

        if (activeAddress) {
          const userEntry = formatted.find((p) => p.address.toLowerCase() === activeAddress.toLowerCase());
          if (userEntry) {
            setHighScore(userEntry.score);
            gameStateRef.current.highScore = userEntry.score;
          }
        }
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
  }, [activeAddress]);

  useEffect(() => {
    setMounted(true);
    fetchGlobalLeaderboard();

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts && accounts[0]) {
            setDirectAddress(accounts[0]);
          }
        })
        .catch(() => {});
    }
  }, [fetchGlobalLeaderboard]);

  useEffect(() => {
    if (isLeaderboardOpen) {
      fetchGlobalLeaderboard();
    }
  }, [isLeaderboardOpen, fetchGlobalLeaderboard]);

  const playSound = (type: 'slice' | 'bomb' | 'miss' | 'stone' | 'over') => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'stone') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'bomb') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
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
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.5);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {}
  };

  const formatAddress = (addr: string | null | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-6)}`;
  };

  useEffect(() => {
    if (!isUserConnected || !activeAddress) {
      setIsSessionActive(false);
      return;
    }
    if (activeAddress.toLowerCase() === BUILDER_WALLET) {
      setIsSessionActive(true);
      return;
    }
    const savedSession = sessionStorage.getItem(`session_${activeAddress.toLowerCase()}`);
    setIsSessionActive(savedSession === 'active');
  }, [activeAddress, isUserConnected]);

  useEffect(() => {
    if (isConfirmed && activeAddress) {
      sessionStorage.setItem(`session_${activeAddress.toLowerCase()}`, 'active');
      setIsSessionActive(true);
    }
  }, [isConfirmed, activeAddress]);

  const handleStartSession = async () => {
    if (activeAddress?.toLowerCase() === BUILDER_WALLET) {
      setIsSessionActive(true);
      return;
    }

    if (wagmiConnected) {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: SESSION_ABI,
        functionName: 'startSession',
      });
    } else if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: activeAddress,
              to: CONTRACT_ADDRESS,
              data: '0x43ea0a8e',
            },
          ],
        });
        if (activeAddress) {
          sessionStorage.setItem(`session_${activeAddress.toLowerCase()}`, 'active');
          setIsSessionActive(true);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts && accounts[0]) {
          setDirectAddress(accounts[0]);
        }
      } else if (connectors && connectors.length > 0) {
        const c = connectors[0];
        connect({ connector: c });
      }
    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  };

  const handleDisconnect = () => {
    if (activeAddress) {
      sessionStorage.removeItem(`session_${activeAddress.toLowerCase()}`);
    }
    setDirectAddress(null);
    setIsSessionActive(false);
    setIsPlaying(false);
    gameStateRef.current.isPlaying = false;
    disconnect();
  };

  const triggerGameOver = async () => {
    playSound('over');
    gameStateRef.current.isPlaying = false;
    gameStateRef.current.lives = 0;
    setLives(0);
    setGameOver(true);
    setIsPlaying(false);

    const finalScore = gameStateRef.current.score;
    if (activeAddress && finalScore > 0) {
      if (finalScore > gameStateRef.current.highScore) {
        gameStateRef.current.highScore = finalScore;
        setHighScore(finalScore);
      }

      try {
        await supabase.from('leaderboards').insert([
          {
            address: activeAddress.toLowerCase(),
            score: finalScore,
          },
        ]);
        fetchGlobalLeaderboard();
      } catch (err) {
        console.error('Failed to submit score to Supabase:', err);
      }
    }
  };

  const deductLife = () => {
    const nextLives = gameStateRef.current.lives - 1;
    gameStateRef.current.lives = nextLives;
    setLives(nextLives);
    if (nextLives <= 0) {
      triggerGameOver();
      return false;
    }
    return true;
  };

  const startGame = () => {
    gameStateRef.current = {
      ...gameStateRef.current,
      isPlaying: true,
      score: 0,
      lives: 3,
      objects: [],
      trail: [],
      lastSpawn: Date.now(),
    };
    setScore(0);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (!isSessionActive) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const g = gameStateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (g.isPlaying && Date.now() - g.lastSpawn > g.spawnInterval) {
        g.lastSpawn = Date.now();
        const rand = Math.random();
        const isBomb = rand < 0.16;
        const isStone = !isBomb && rand < 0.36;

        const emojis = ['🍉', '🍎', '🍌', '🍍', '🍓', '🍊', '🍇'];
        let emoji = emojis[Math.floor(Math.random() * emojis.length)];
        if (isBomb) emoji = '💣';
        if (isStone) emoji = '🪨';

        const spawnX = Math.random() * (width - 80) + 40;
        const vx = (Math.random() - 0.5) * 4;
        const vy = -(Math.random() * 3 + 12);

        g.objects.push({
          id: Date.now() + Math.random(),
          x: spawnX,
          y: height + 20,
          vx,
          vy,
          rotation: 0,
          vRot: (Math.random() - 0.5) * 0.1,
          emoji,
          isBomb,
          isStone,
          sliced: false,
          missed: false,
          radius: 26,
        });
      }

      for (let i = g.objects.length - 1; i >= 0; i--) {
        const obj = g.objects[i];

        if (!obj.sliced) {
          obj.x += obj.vx;
          obj.y += obj.vy;
          obj.vy += 0.28;
          obj.rotation += obj.vRot;

          if (obj.y > height + 40) {
            if (g.isPlaying && !obj.missed && !obj.isBomb && !obj.isStone) {
              obj.missed = true;
              playSound('miss');
              deductLife();
            }
            g.objects.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.translate(obj.x, obj.y);
          ctx.rotate(obj.rotation);
          ctx.font = '38px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.emoji, 0, 0);
          ctx.restore();
        } else {
          if (obj.leftPiece && obj.rightPiece) {
            obj.leftPiece.x += obj.leftPiece.vx;
            obj.leftPiece.y += obj.leftPiece.vy;
            obj.leftPiece.vy += 0.35;
            obj.leftPiece.rot -= 0.1;

            obj.rightPiece.x += obj.rightPiece.vx;
            obj.rightPiece.y += obj.rightPiece.vy;
            obj.rightPiece.vy += 0.35;
            obj.rightPiece.rot += 0.1;

            ctx.save();
            ctx.translate(obj.leftPiece.x, obj.leftPiece.y);
            ctx.rotate(obj.leftPiece.rot);
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.emoji, 0, 0);
            ctx.restore();

            ctx.save();
            ctx.translate(obj.rightPiece.x, obj.rightPiece.y);
            ctx.rotate(obj.rightPiece.rot);
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obj.emoji, 0, 0);
            ctx.restore();

            if (obj.leftPiece.y > height + 60 && obj.rightPiece.y > height + 60) {
              g.objects.splice(i, 1);
            }
          } else {
            g.objects.splice(i, 1);
          }
        }
      }

      if (g.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(g.trail[0].x, g.trail[0].y);
        for (let i = 1; i < g.trail.length; i++) {
          ctx.lineTo(g.trail[i].x, g.trail[i].y);
        }
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      g.trail = g.trail.filter((pt) => {
        pt.age -= 1;
        return pt.age > 0;
      });

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [isSessionActive]);

  const handleBladeMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const g = gameStateRef.current;
    g.trail.push({ x, y, age: 10 });

    if (!g.isPlaying) return;

    for (const obj of g.objects) {
      if (!obj.sliced) {
        const dist = Math.hypot(obj.x - x, obj.y - y);
        if (dist < obj.radius + 15) {
          obj.sliced = true;
          obj.leftPiece = { x: obj.x - 8, y: obj.y, vx: -3, vy: -2, rot: 0 };
          obj.rightPiece = { x: obj.x + 8, y: obj.y, vx: 3, vy: -2, rot: 0 };

          if (obj.isBomb) {
            playSound('bomb');
            triggerGameOver();
            return;
          } else if (obj.isStone) {
            playSound('stone');
            deductLife();
          } else {
            playSound('slice');
            g.score += 1;
            setScore(g.score);
          }
        }
      }
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 selection:bg-blue-500 selection:text-white">
      <header className="w-full max-w-md flex justify-between items-center py-2.5 px-4 bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-black text-sm tracking-wide text-slate-200">BASE NINJA</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-2.5 py-1 rounded-xl border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
          >
            🏆 Leaderboard
          </button>

          {isUserConnected && activeAddress ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-slate-800 text-blue-400 font-mono px-2.5 py-1 rounded-full border border-blue-500/30">
                {formatAddress(activeAddress)}
              </span>
              {activeAddress.toLowerCase() === BUILDER_WALLET && (
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

      <div className="w-full max-w-md my-auto flex flex-col items-center gap-4">
        {!isUserConnected ? (
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

            <div className="relative w-full h-[400px] bg-gradient-to-b from-slate-950/40 to-slate-900/60 flex items-center justify-center overflow-hidden select-none">
              <canvas
                ref={canvasRef}
                width={360}
                height={400}
                onMouseMove={(e) => handleBladeMove(e.clientX, e.clientY)}
                onTouchMove={(e) => {
                  if (e.touches[0]) handleBladeMove(e.touches[0].clientX, e.touches[0].clientY);
                }}
                className="w-full h-full cursor-crosshair touch-none select-none block"
              />

              {!isPlaying && !gameOver && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
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
            </div>
          </div>
        )}
      </div>

      {isLeaderboardOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setIsLeaderboardOpen(false)}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            >
              ✕
            </button>
            <Leaderboard
              userAddress={activeAddress || undefined}
              allScores={leaderboard}
            />
          </div>
        </div>
      )}

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