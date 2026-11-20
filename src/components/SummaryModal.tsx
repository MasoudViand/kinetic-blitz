import React, { useEffect } from 'react';
import { PlayerStats, GameMode, DifficultyLevel } from '../types/game';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  Flame,
  Award,
  Zap,
  Shield,
  Sun,
  Menu,
} from 'lucide-react';

interface SummaryModalProps {
  stats: PlayerStats;
  mode: GameMode;
  difficulty?: DifficultyLevel;
  onPlayAgain: () => void;
  onReturnToMenu: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  stats,
  mode,
  difficulty = 'medium',
  onPlayAgain,
  onReturnToMenu,
}) => {
  const getRank = (score: number) => {
    if (score >= 4500) return { rank: 'S', color: 'text-pulse-gold text-glow-gold' };
    if (score >= 2800) return { rank: 'A', color: 'text-pulse-cyan text-glow-cyan' };
    if (score >= 1500) return { rank: 'B', color: 'text-pulse-magenta text-glow-magenta' };
    return { rank: 'C', color: 'text-gray-300' };
  };

  const { rank, color } = getRank(stats.score);
  const highscoreKey = `kinetic_blitz_highscore_${mode}`;
  const highscore = parseInt(localStorage.getItem(highscoreKey) || localStorage.getItem(`kinetic_pulse_highscore_${mode}`) || '0', 10);
  const isNewRecord = stats.score > 0 && stats.score >= highscore;

  useEffect(() => {
    // Fire confetti celebration on completion
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f3ff', '#ff007f', '#ffd700', '#ffffff'],
      });
    } catch {
      // Ignored if canvas not ready
    }
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-2 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="max-w-md w-full scale-90 sm:scale-95 md:scale-100 bg-slate-900/90 border border-slate-700 rounded-2xl p-4 text-center shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-200">
        {/* Top Trophy & Record Badge */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-1.5 rounded-full bg-pulse-gold/15 border border-pulse-gold/30 text-pulse-gold">
            <Trophy className="w-5 h-5" />
          </div>
          {isNewRecord && (
            <span className="px-2.5 py-0.5 rounded-full bg-pulse-gold text-black text-[10px] font-arcade font-bold tracking-wider uppercase shadow-glow-gold">
              NEW RECORD!
            </span>
          )}
        </div>

        <h3 className="text-2xl md:text-3xl font-black font-arcade text-white tracking-wider">
          WORKOUT COMPLETE
        </h3>
        <p className="text-xs text-gray-400 capitalize mb-3.5">
          <span className="uppercase text-pulse-cyan font-bold font-arcade">{difficulty}</span> • {mode} Session
        </p>

        {/* Score & Rank Card */}
        <div className="w-full flex items-center justify-between p-3.5 rounded-xl bg-black/60 border border-slate-800 mb-3.5">
          <div className="text-left">
            <div className="text-[10px] font-arcade text-gray-400 uppercase tracking-widest">Total Score</div>
            <div className="text-3xl md:text-4xl font-black font-arcade text-white tracking-wider">
              {stats.score.toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Best: <span className="font-bold text-gray-200">{highscore.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center pr-2">
            <div className="text-[10px] font-arcade text-gray-400 uppercase tracking-widest">Rank</div>
            <div className={`text-4xl font-black font-arcade ${color}`}>{rank}</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 w-full mb-3.5 text-left">
          {/* Pulse Hits */}
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center gap-2">
            <Zap className="w-4 h-4 text-pulse-cyan shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400">Pulse Strikes</div>
              <div className="text-xs font-arcade font-bold text-white">
                {stats.pulseHits}{' '}
                <span className="text-[9px] text-pulse-gold font-normal">({stats.powerHits} Power)</span>
              </div>
            </div>
          </div>

          {/* Solar Holds */}
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center gap-2">
            <Sun className="w-4 h-4 text-pulse-gold shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400">Solar Holds</div>
              <div className="text-xs font-arcade font-bold text-white">{stats.solarHolds}</div>
            </div>
          </div>

          {/* Laser Dodges */}
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400">Lasers Dodged</div>
              <div className="text-xs font-arcade font-bold text-white">
                {stats.lasersDodged}{' '}
                <span className="text-[9px] text-red-400 font-normal">({stats.lasersHit} hits)</span>
              </div>
            </div>
          </div>

          {/* Max Combo & Calories */}
          <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] text-gray-400">Calories Burned</div>
              <div className="text-xs font-arcade font-bold text-white">
                {stats.caloriesBurned.toFixed(1)} <span className="text-[9px] text-gray-400 font-normal">kcal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Max Combo Badge */}
        <div className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-black/40 border border-slate-800 text-xs font-arcade text-gray-300 mb-4">
          <Award className="w-3.5 h-3.5 text-pulse-magenta" />
          <span>Max Combo Achieved:</span>
          <span className="font-bold text-pulse-magenta">{stats.maxCombo}x</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta font-arcade font-bold text-black shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            PLAY AGAIN
          </button>

          <button
            onClick={onReturnToMenu}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-arcade text-xs font-semibold text-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <Menu className="w-4 h-4" />
            Change Mode / Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
