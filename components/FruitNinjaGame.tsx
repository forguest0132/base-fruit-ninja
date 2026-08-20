'use client';

import React, { useRef, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Heart, Trophy, RefreshCw, Flame, ShieldAlert, Zap, Sparkles, Gauge } from 'lucide-react';

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'watermelon' | 'apple' | 'banana' | 'orange' | 'pineapple' | 'stone' | 'golden_banana';
  points: number;
  sliced: boolean;
  color: string;
  emoji: string;
  rotation: number;
  vRot: number;
}

interface SlicedHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  rotation: number;
  vRot: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface BladeSkin {
  id: string;
  name: string;
  color: string;
  glow: string;
  unlockType: 'score' | 'rank' | 'default';
  requirement: number;
}

const BLADE_SKINS: BladeSkin[] = [
  { id: 'base_neon', name: 'Base Blue', color: '#0052FF', glow: '#38bdf8', unlockType: 'default', requirement: 0 },
  { id: 'fire_blade', name: 'Fire Blade', color: '#f97316', glow: '#ef4444', unlockType: 'score', requirement: 500 },
  { id: 'golden_katana', name: 'Golden Katana', color: '#fbbf24', glow: '#f59e0b', unlockType: 'rank', requirement: 3 },
];

class SoundEngine {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  playWhoosh() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }

  playSquish() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  playPowerup() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(900, this.ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {}
  }

  playStoneClash() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch {}
  }
}

const sounds = new SoundEngine();

interface FruitNinjaGameProps {
  userAddress: string;
  onGameOver: (finalScore: number) => void;
}

export default function FruitNinjaGame({ userAddress, onGameOver }: FruitNinjaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOverState, setIsGameOverState] = useState(false);
  const [comboText, setComboText] = useState<string | null>(null);
  const [selectedBlade, setSelectedBlade] = useState<BladeSkin>(BLADE_SKINS[0]);
  const [bestScore, setBestScore] = useState(0);
  const [userRank] = useState(2);
  const [isFrenzy, setIsFrenzy] = useState(false);

  const gameState = useRef({
    score: 0,
    lives: 3,
    fruits: [] as Fruit[],
    slicedHalves: [] as SlicedHalf[],
    particles: [] as Particle[],
    bladeTrail: [] as { x: number; y: number; time: number }[],
    isMouseDown: false,
    lastSpawn: 0,
    animId: 0,
    shake: 0,
    frenzyUntil: 0,
    selectedBlade: BLADE_SKINS[0],
  });

  useEffect(() => {
    gameState.current.selectedBlade = selectedBlade;
  }, [selectedBlade]);

  useEffect(() => {
    const savedBest = localStorage.getItem('fn_best_score');
    if (savedBest) setBestScore(parseInt(savedBest, 10));
  }, []);

  const triggerHaptic = (duration: number = 40) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  };

  const getSpeedMultiplier = (currentScore: number) => {
    if (currentScore >= 4000) return 3.0;
    if (currentScore >= 3000) return 2.0;
    if (currentScore >= 2000) return 1.5;
    if (currentScore >= 1000) return 1.25;
    return 1.0;
  };

  const FRUIT_TYPES = [
    { type: 'watermelon' as const, points: 10, radius: 36, color: '#22c55e', emoji: '🍉' },
    { type: 'apple' as const, points: 5, radius: 28, color: '#ef4444', emoji: '🍎' },
    { type: 'banana' as const, points: 8, radius: 30, color: '#eab308', emoji: '🍌' },
    { type: 'orange' as const, points: 6, radius: 28, color: '#f97316', emoji: '🍊' },
    { type: 'pineapple' as const, points: 15, radius: 38, color: '#f59e0b', emoji: '🍍' },
  ];

  const spawnFruit = (width: number, height: number, speedMult: number) => {
    const rand = Math.random();
    let typeObj;

    if (rand < 0.22) {
      typeObj = { type: 'stone' as const, points: 0, radius: 36, color: '#475569', emoji: '🪨' };
    } else if (rand < 0.28) {
      typeObj = { type: 'golden_banana' as const, points: 25, radius: 34, color: '#fbbf24', emoji: '🍌' };
    } else {
      typeObj = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    }

    const x = Math.random() * (width - 120) + 60;
    const y = height + 40;
    const vx = (Math.random() - 0.5) * (6 * speedMult);
    const vy = -(Math.random() * 4 + 13.5) * Math.min(speedMult, 1.8);

    gameState.current.fruits.push({
      id: Math.random(),
      x,
      y,
      vx,
      vy,
      radius: typeObj.radius,
      type: typeObj.type,
      points: typeObj.points,
      sliced: false,
      color: typeObj.color,
      emoji: typeObj.emoji,
      rotation: 0,
      vRot: (Math.random() - 0.5) * 0.1 * speedMult,
    });
  };

  const createSplashParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 16; i++) {
      gameState.current.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        color,
        alpha: 1,
        size: Math.random() * 6 + 3,
      });
    }
  };

  const createHalves = (fruit: Fruit) => {
    gameState.current.slicedHalves.push({
      x: fruit.x - 10,
      y: fruit.y,
      vx: fruit.vx - 3.5,
      vy: fruit.vy * 0.5,
      emoji: fruit.emoji,
      rotation: fruit.rotation,
      vRot: -0.15,
      alpha: 1,
    });
    gameState.current.slicedHalves.push({
      x: fruit.x + 10,
      y: fruit.y,
      vx: fruit.vx + 3.5,
      vy: fruit.vy * 0.5,
      emoji: fruit.emoji,
      rotation: fruit.rotation,
      vRot: 0.15,
      alpha: 1,
    });
  };

  // High-clarity procedural stone drawing
  const drawProceduralStone = (ctx: CanvasRenderingContext2D, radius: number) => {
    ctx.save();

    // Danger red glow around stone
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;

    // Outer Dark Granite Rock Base
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;

    ctx.beginPath();
    // Angular jagged stone shape
    ctx.moveTo(-radius * 0.9, -radius * 0.4);
    ctx.lineTo(-radius * 0.4, -radius * 0.95);
    ctx.lineTo(radius * 0.5, -radius * 0.85);
    ctx.lineTo(radius * 0.95, -radius * 0.2);
    ctx.lineTo(radius * 0.75, radius * 0.8);
    ctx.lineTo(-radius * 0.2, radius * 0.95);
    ctx.lineTo(-radius * 0.85, radius * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Reset shadow for internal details
    ctx.shadowBlur = 0;

    // Rock Shading / Facets
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, -radius * 0.95);
    ctx.lineTo(radius * 0.2, -radius * 0.3);
    ctx.lineTo(-radius * 0.2, radius * 0.95);
    ctx.lineTo(-radius * 0.85, radius * 0.5);
    ctx.closePath();
    ctx.fill();

    // Sharp Highlight Top-Edge
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, -radius * 0.95);
    ctx.lineTo(radius * 0.5, -radius * 0.85);
    ctx.lineTo(radius * 0.95, -radius * 0.2);
    ctx.stroke();

    // Danger Warning Symbol (Skull / Exclamation)
    ctx.fillStyle = '#f87171';
    ctx.font = `bold ${radius * 0.75}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', 0, 0);

    ctx.restore();
  };

  const startGame = () => {
    gameState.current.score = 0;
    gameState.current.lives = 3;
    gameState.current.fruits = [];
    gameState.current.slicedHalves = [];
    gameState.current.particles = [];
    gameState.current.bladeTrail = [];
    gameState.current.shake = 0;
    gameState.current.frenzyUntil = 0;

    setScore(0);
    setLives(3);
    setIsFrenzy(false);
    setIsPlaying(true);
    setIsGameOverState(false);
  };

  const handleGameOver = () => {
    setIsPlaying(false);
    setIsGameOverState(true);
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });

    if (gameState.current.score > bestScore) {
      setBestScore(gameState.current.score);
      localStorage.setItem('fn_best_score', gameState.current.score.toString());
    }

    onGameOver(gameState.current.score);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 360;
      canvas.height = 520;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const addBladePoint = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      const posX = x - rect.left;
      const posY = y - rect.top;

      gameState.current.bladeTrail.push({ x: posX, y: posY, time: Date.now() });
      if (gameState.current.bladeTrail.length > 12) {
        gameState.current.bladeTrail.shift();
      }

      sounds.playWhoosh();

      let slicedThisSwipe = 0;
      const now = Date.now();
      const multiplier = now < gameState.current.frenzyUntil ? 2 : 1;

      gameState.current.fruits.forEach(fruit => {
        if (!fruit.sliced) {
          const dist = Math.hypot(fruit.x - posX, fruit.y - posY);
          if (dist < fruit.radius + 18) {
            fruit.sliced = true;
            createSplashParticles(fruit.x, fruit.y, fruit.color);

            if (fruit.type === 'stone') {
              sounds.playStoneClash();
              triggerHaptic(90);
              gameState.current.shake = 18;
              gameState.current.lives -= 1;
              setLives(gameState.current.lives);
              if (gameState.current.lives <= 0) {
                handleGameOver();
              }
            } else if (fruit.type === 'golden_banana') {
              sounds.playPowerup();
              triggerHaptic(40);
              gameState.current.frenzyUntil = now + 5000;
              setIsFrenzy(true);
              setTimeout(() => setIsFrenzy(false), 5000);
              gameState.current.score += fruit.points;
              setScore(gameState.current.score);
            } else {
              sounds.playSquish();
              triggerHaptic(25);
              createHalves(fruit);
              gameState.current.score += fruit.points * multiplier;
              slicedThisSwipe++;
              setScore(gameState.current.score);
            }
          }
        }
      });

      if (slicedThisSwipe >= 3) {
        sounds.playPowerup();
        const bonus = slicedThisSwipe * 5;
        gameState.current.score += bonus;
        setScore(gameState.current.score);
        setComboText(`🔥 COMBO x${slicedThisSwipe} +${bonus}!`);
        setTimeout(() => setComboText(null), 1200);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      gameState.current.isMouseDown = true;
      addBladePoint(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (gameState.current.isMouseDown) {
        addBladePoint(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      gameState.current.isMouseDown = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        addBladePoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchmove', handleTouchMove);

    let lastTime = Date.now();
    const gameLoop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      ctx.save();

      if (gameState.current.shake > 0) {
        const shakeX = (Math.random() - 0.5) * gameState.current.shake;
        const shakeY = (Math.random() - 0.5) * gameState.current.shake;
        ctx.translate(shakeX, shakeY);
        gameState.current.shake = Math.max(0, gameState.current.shake - 45 * dt);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        const isFrenzyActive = now < gameState.current.frenzyUntil;
        const speedMult = getSpeedMultiplier(gameState.current.score);
        const spawnDelay = isFrenzyActive ? 480 : Math.max(500, 1000 - (speedMult - 1) * 200);

        if (now - gameState.current.lastSpawn > spawnDelay) {
          spawnFruit(canvas.width, canvas.height, speedMult);
          if (isFrenzyActive || Math.random() < 0.35 + (speedMult - 1) * 0.1) {
            spawnFruit(canvas.width, canvas.height, speedMult);
          }
          gameState.current.lastSpawn = now;
        }

        // Render fruits and stones
        for (let i = gameState.current.fruits.length - 1; i >= 0; i--) {
          const f = gameState.current.fruits[i];
          f.x += f.vx;
          f.y += f.vy;
          f.vy += 22 * dt * speedMult;
          f.rotation += f.vRot;

          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rotation);

          if (f.type === 'stone') {
            // Render real solid jagged rock with red danger aura
            drawProceduralStone(ctx, f.radius);
          } else {
            ctx.font = `${f.radius * 1.4}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.emoji, 0, 0);

            if (f.type === 'golden_banana') {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, 0, f.radius + 4, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.restore();

          if (f.y > canvas.height + 60 || f.sliced) {
            gameState.current.fruits.splice(i, 1);
          }
        }

        // Render sliced halves
        for (let i = gameState.current.slicedHalves.length - 1; i >= 0; i--) {
          const h = gameState.current.slicedHalves[i];
          h.x += h.vx;
          h.y += h.vy;
          h.vy += 24 * dt * speedMult;
          h.rotation += h.vRot;
          h.alpha -= 1.2 * dt;

          if (h.alpha <= 0 || h.y > canvas.height + 50) {
            gameState.current.slicedHalves.splice(i, 1);
          } else {
            ctx.save();
            ctx.globalAlpha = h.alpha;
            ctx.translate(h.x, h.y);
            ctx.rotate(h.rotation);
            ctx.font = '26px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(h.emoji, 0, 0);
            ctx.restore();
          }
        }

        // Render particles
        for (let i = gameState.current.particles.length - 1; i >= 0; i--) {
          const p = gameState.current.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 1.8 * dt;

          if (p.alpha <= 0) {
            gameState.current.particles.splice(i, 1);
          } else {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Render blade trail
      const trail = gameState.current.bladeTrail;
      const skin = gameState.current.selectedBlade;
      if (trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.strokeStyle = skin.color;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.shadowColor = skin.glow;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
      gameState.current.animId = requestAnimationFrame(gameLoop);
    };

    gameState.current.animId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(gameState.current.animId);
    };
  }, [isPlaying]);

  const activeSpeed = getSpeedMultiplier(score);

  return (
    <div className="relative w-full max-w-md bg-[#181512] rounded-[32px] overflow-hidden border-2 border-[#3d3226] shadow-2xl">
      {/* Top HUD */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#26201a]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#4a3d2e] shadow-md">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-black text-amber-100 text-sm">{score} PTS</span>
          </div>

          {activeSpeed > 1 && (
            <div className="flex items-center gap-1 text-[10px] font-black font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/50">
              <Gauge className="w-3 h-3" /> {activeSpeed}x SPEED
            </div>
          )}
        </div>

        {comboText && (
          <div className="animate-bounce text-xs font-black font-mono text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-500/50">
            {comboText}
          </div>
        )}

        {isFrenzy && (
          <div className="animate-pulse flex items-center gap-1 text-[11px] font-black font-mono text-amber-400 bg-amber-950/90 px-2.5 py-1 rounded-full border border-amber-500">
            <Zap className="w-3.5 h-3.5" /> 2X FRENZY!
          </div>
        )}

        <div className="flex items-center gap-1 bg-[#26201a]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#4a3d2e] shadow-md">
          {[1, 2, 3].map(heartIdx => (
            <Heart
              key={heartIdx}
              className={`w-4 h-4 transition-all duration-300 ${
                heartIdx <= lives ? 'fill-rose-500 text-rose-500 scale-100' : 'text-zinc-600 scale-90 opacity-40'
              }`}
            />
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-[520px] block cursor-crosshair touch-none bg-gradient-to-b from-[#221c17] via-[#1a1512] to-[#120f0d]" />

      {/* Intro Modal */}
      {!isPlaying && !isGameOverState && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-500 flex items-center justify-center text-3xl shadow-lg mb-3">
            🍉
          </div>
          <h2 className="text-3xl font-black text-amber-100 tracking-tight mb-1 font-serif">
            Fruit Ninja
          </h2>
          <p className="text-xs text-amber-200/70 max-w-[260px] mb-4 leading-relaxed">
            Slice fruits, collect 🍌 <b>Frenzy</b>. Higher scores increase game speed up to <b>3x</b>! Avoid <b>Danger Stones ✕</b>!
          </p>

          {/* Blade Arsenal Selector */}
          <div className="w-full max-w-[300px] bg-[#1c1813] border border-[#3d3226] rounded-2xl p-2.5 mb-4">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block mb-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Select Blade Skin
            </span>
            <div className="flex gap-1.5 justify-center">
              {BLADE_SKINS.map(skin => {
                let isUnlocked = false;
                let requirementLabel = '';

                if (skin.unlockType === 'default') {
                  isUnlocked = true;
                } else if (skin.unlockType === 'score') {
                  isUnlocked = bestScore >= skin.requirement;
                  requirementLabel = `${skin.requirement}+ pts`;
                } else if (skin.unlockType === 'rank') {
                  isUnlocked = userRank <= skin.requirement;
                  requirementLabel = 'Weekly Top 3';
                }

                const isSelected = selectedBlade.id === skin.id;

                return (
                  <button
                    key={skin.id}
                    disabled={!isUnlocked}
                    onClick={() => setSelectedBlade(skin)}
                    className={`flex-1 py-1.5 px-1.5 rounded-xl text-[10px] font-mono font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-800 border-2 border-[#0052FF] text-white shadow-md'
                        : isUnlocked
                        ? 'bg-[#26201a] text-zinc-300 hover:border-zinc-500 border border-transparent'
                        : 'bg-zinc-900/50 text-zinc-600 opacity-50 cursor-not-allowed border border-transparent'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: skin.color }} />
                    <span className="truncate w-full text-center">{skin.name}</span>
                    {!isUnlocked && <span className="text-[8px] text-zinc-500">{requirementLabel}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-[280px] py-3.5 rounded-2xl bg-[#0052FF] hover:bg-[#0045d8] text-white font-bold text-base transition-all shadow-[0_0_25px_rgba(0,82,255,0.4)] active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Flame className="w-5 h-5" /> Start Slicing
          </button>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameOverState && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <ShieldAlert className="w-12 h-12 text-rose-500 mb-2" />
          <h3 className="text-2xl font-black text-white tracking-tight mb-1">Game Over!</h3>
          <p className="text-xs text-zinc-400 mb-4">You hit 3 danger stones with your blade!</p>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 w-full max-w-[240px] mb-5">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Final Score</span>
            <div className="text-3xl font-mono font-black text-white">{score}</div>
          </div>

          <button
            onClick={startGame}
            className="w-full max-w-[240px] py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Play Again
          </button>
        </div>
      )}
    </div>
  );
}