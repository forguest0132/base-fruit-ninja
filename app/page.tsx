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
  sliced: boolean;
  size: number;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [fruits, setFruits] = useState<FruitItem[]>([]);

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const animationFrameRef = useRef<number | null>(null);

  // Format address: 0x12...a1b2c3
  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}...${addr.slice(-6)}`;
  };

  // Check Builder Whitelist or Session Status
  useEffect(() => {
    if (!isConnected || !address) {
      setIsSessionActive(false);
      return;
    }

    if (address.toLowerCase() === BUILDER_WALLET) {
      setIsSessionActive(true); // Builder bypasses gas requirement
      return;
    }

    const savedSession = sessionStorage.getItem(`session_${address.toLowerCase()}`);
    if (savedSession === 'active') {
      setIsSessionActive(true);
    } else {
      setIsSessionActive(false);
    }
  }, [address, isConnected]);

  // Handle successful transaction confirmation
  useEffect(() => {
    if (isConfirmed && address) {
      sessionStorage.setItem(`session_${address.toLowerCase()}`, 'active');
      setIsSessionActive(true);
    }
  }, [isConfirmed, address]);

  // Load High Score
  useEffect(() => {
    if (address) {
      const saved = localStorage.getItem(`highScore_${address.toLowerCase()}`);
      if (saved) setHighScore(parseInt(saved, 10));
    }
  }, [address]);

  // Trigger Onchain Session Start
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

  // Connect first available wallet connector (Injected / Rabby / Metamask)
  const handleConnectWallet = () => {
    const injectedConnector = connectors.find((c) => c.id === 'injected') || connectors[0];
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  // Start Game
  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setIsPlaying(true);
    setFruits([]);
  };

  // Game Engine Loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (Math.random() < 0.65) {
        const isBomb = Math.random() < 0.2;
        const emojis = ['🍉', '🍎', '🍌', '🍍', '🍓', '🍊', '🍇'];
        const newFruit: FruitItem = {
          id: Date.now() + Math.random(),
          x: Math.random() * 260 + 20,
          y: 450,
          vx: (Math.random() - 0.5) * 4,
          vy: -(Math.random() * 4 + 10),
          emoji: isBomb ? '💣' : emojis[Math.floor(Math.random() * emojis.length)],
          isBomb,
          sliced: false,
          size: 40,
        };
        setFruits((prev) => [...prev, newFruit]);
      }
    }, 900);

    const updatePhysics = () => {
      setFruits((prev) =>
        prev
          .map((f) => ({
            ...f,
            x: f.x + f.vx,
            y: f.y + f.vy,
            vy: f.vy + 0.22,
          }))
          .filter((f) => {
            if (f.y > 480 && !f.sliced && !f.isBomb) {
              setLives((l) => {
                if (l <= 1) {
                  setGameOver(true);
                  setIsPlaying(false);
                  return 0;
                }
                return l - 1;
              });
            }
            return f.y < 500;
          })
      );
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    animationFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      clearInterval(interval);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  // Handle Score Updates
  useEffect(() => {
    if (score > highScore && address) {
      setHighScore(score);
      localStorage.setItem(`highScore_${address.toLowerCase()}`, score.toString());
    }
  }, [score, highScore, address]);

  // Slice Fruit Handler
  const sliceItem = (id: number) => {
    setFruits((prev) =>
      prev.map((f) => {
        if (f.id === id && !f.sliced) {
          if (f.isBomb) {
            setGameOver(true);
            setIsPlaying(false);
          } else {
            setScore((s) => s + 1);
          }
          return { ...f, sliced: true };
        }
        return f;
      })
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 selection:bg-blue-500 selection:text-white">
      {/* Top Bar */}
      <header className="w-full max-w-md flex justify-between items-center py-2 px-4 bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-800 shadow-lg">
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
                onClick={() => disconnect()}
                className="text-[10px] text-slate-500 hover:text-red-400 transition"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-xl font-bold transition shadow-sm"
            >
              Connect
            </button>
          )}
        </div>
      </header>

      {/* Main Screen */}
      <div className="w-full max-w-md my-auto flex flex-col items-center">
        {!isConnected ? (
          <div className="w-full p-8 bg-slate-900/90 rounded-3xl border border-slate-800 text-center shadow-2xl">
            <span className="text-5xl">🍉</span>
            <h1 className="text-2xl font-black mt-4 text-slate-100">Base Fruit Ninja</h1>
            <p className="text-xs text-slate-400 mt-2 mb-6">Connect your wallet to slice fruits and climb the onchain ranks.</p>
            <button
              onClick={handleConnectWallet}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/30"
            >
              Connect Wallet 🔵
            </button>
          </div>
        ) : !isSessionActive ? (
          <div className="w-full p-8 bg-slate-900/90 rounded-3xl border border-slate-800 text-center shadow-2xl">
            <span className="text-5xl">🎟️</span>
            <h2 className="text-xl font-bold mt-4 text-slate-100">Start Onchain Session</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
              Create an onchain play session on Base. 0 ETH fee (only standard micro-gas applied). Unlimited plays for this session!
            </p>
            <button
              onClick={handleStartSession}
              disabled={isPending || isConfirming}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50"
            >
              {isPending ? 'Check Wallet...' : isConfirming ? 'Creating Session...' : 'Start Session 🔵'}
            </button>
          </div>
        ) : (
          <div className="w-full relative bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col items-center">
            {/* Game Stats Header */}
            <div className="w-full flex justify-between items-center p-4 bg-slate-950/40 border-b border-slate-800/60">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{score}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Lives</span>
                <div className="flex gap-1 text-sm mt-0.5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={i < lives ? 'opacity-100' : 'opacity-20'}>
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

            {/* Game Field */}
            <div className="relative w-full h-[440px] bg-gradient-to-b from-slate-950/30 to-slate-900/50 flex items-center justify-center overflow-hidden select-none">
              {!isPlaying && !gameOver && (
                <div className="text-center p-6 flex flex-col items-center">
                  <span className="text-6xl mb-3 animate-bounce">⚔️</span>
                  <h3 className="text-xl font-black text-slate-100">Ready to Slice?</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-6">Slice flying fruits, avoid 💣 bombs!</p>
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30"
                  >
                    Play Now 🍉
                  </button>
                </div>
              )}

              {gameOver && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-5xl mb-2">💥</span>
                  <h3 className="text-2xl font-black text-red-400">Game Over</h3>
                  <p className="text-sm text-slate-300 mt-1">Final Score: <span className="font-bold text-blue-400 font-mono">{score}</span></p>
                  <p className="text-xs text-slate-400 mb-6">Best: <span className="font-bold text-amber-400 font-mono">{highScore}</span></p>
                  <button
                    onClick={startGame}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl transition shadow-lg shadow-blue-600/30"
                  >
                    Play Again 🔄
                  </button>
                </div>
              )}

              {/* Slicing Objects */}
              {fruits.map((f) => (
                <div
                  key={f.id}
                  onMouseEnter={() => sliceItem(f.id)}
                  onTouchStart={() => sliceItem(f.id)}
                  style={{
                    transform: `translate(${f.x}px, ${f.y}px)`,
                    opacity: f.sliced ? 0 : 1,
                    transition: f.sliced ? 'opacity 0.15s ease-out' : 'none',
                  }}
                  className="absolute cursor-pointer text-4xl select-none touch-none hover:scale-125 transition-transform"
                >
                  {f.emoji}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Attribution */}
      <footer className="w-full max-w-md flex flex-col items-center gap-1.5 py-2 text-center">
        <span className="text-[11px] text-slate-400">
          Built on <span className="text-blue-400 font-semibold">Base</span> by{' '}
          <a
            href="https://warpcast.com/0xboysun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 font-semibold underline hover:text-blue-400 transition"
          >
            @0xboysun
          </a>
        </span>
        <span className="text-[10px] font-mono text-slate-600">
          Contract: {formatAddress(CONTRACT_ADDRESS)}
        </span>
      </footer>
    </main>
  );
}