import React from 'react';
import { PlayerStats, CameraMode, PostureType, GameState } from '../types/game';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Eye,
  Activity,
  Flame,
  Award,
  LogOut,
} from 'lucide-react';

interface GameHUDProps {
  stats: PlayerStats;
  timeRemaining: number;
  isEndless: boolean;
  gameState: GameState;
  posture: PostureType;
  cameraMode: CameraMode;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleCameraMode: () => void;
  onPauseToggle: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  timeRemaining,
  isEndless,
  gameState,
  posture,
  cameraMode,
  isMuted,
  onToggleMute,
  onToggleCameraMode,
  onPauseToggle,
  onRestart,
  onExit,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getComboColor = (combo: number) => {
    switch (combo) {
      case 4: return 'text-pulse-gold text-glow-gold border-pulse-gold';
      case 3: return 'text-pulse-magenta text-glow-magenta border-pulse-magenta';
      case 2: return 'text-pulse-cyan text-glow-cyan border-pulse-cyan';
      default: return 'text-gray-300 border-gray-700';
    }
  };

  return (
    <>
      {/* Top HUD Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 md:p-6 pointer-events-none">
        {/* Left: Score & Multiplier */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Score Box */}
          <div className="flex flex-col bg-slate-900/75 border border-slate-700/80 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
            <span className="text-[10px] font-arcade uppercase tracking-widest text-gray-400">Score</span>
            <span className="text-2xl md:text-3xl font-black font-arcade text-white tracking-wider text-glow-cyan">
              {stats.score.toLocaleString()}
            </span>
          </div>

          {/* Combo Multiplier */}
          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-black/60 backdrop-blur-md transition-all shadow-md ${getComboColor(
              stats.combo
            )}`}
          >
            <Award className="w-4 h-4" />
            <span className="text-lg md:text-xl font-black font-arcade">{stats.combo}x</span>
            <span className="text-[10px] font-arcade tracking-wider uppercase opacity-80">Combo</span>
          </div>
        </div>

        {/* Center: Timer Clock */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/75 border border-slate-700/80 px-4 py-2 rounded-xl backdrop-blur-md shadow-lg">
          <Activity className="w-4 h-4 text-pulse-cyan animate-pulse" />
          <span className="text-xl md:text-2xl font-black font-arcade text-white tracking-widest">
            {isEndless ? 'ENDLESS' : formatTime(timeRemaining)}
          </span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Mute Button */}
          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-700/80 hover:border-pulse-cyan text-gray-300 hover:text-white transition-all backdrop-blur-md"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-pulse-cyan" />}
          </button>

          {/* Pause / Resume Button */}
          <button
            onClick={onPauseToggle}
            className="p-2.5 rounded-xl bg-slate-900/75 border border-slate-700/80 hover:border-pulse-cyan text-gray-300 hover:text-white transition-all backdrop-blur-md"
            title={gameState === 'paused' ? 'Resume Workout' : 'Pause Workout'}
          >
            {gameState === 'paused' ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-gray-200" />}
          </button>
        </div>
      </div>

      {/* Bottom HUD Bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-between p-4 md:p-6 pointer-events-none">
        {/* Left: Live Posture Status & Calories */}
        <div className="flex items-center gap-3 pointer-events-auto ml-32">
          <div className="flex items-center gap-2 bg-slate-900/75 border border-slate-700/80 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-pulse-cyan animate-ping" />
            <span className="text-xs font-arcade font-bold uppercase tracking-wider text-pulse-cyan">
              {posture} Mode
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/75 border border-slate-700/80 px-3 py-1.5 rounded-xl backdrop-blur-md">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-arcade font-bold text-gray-200">
              {stats.caloriesBurned.toFixed(1)} <span className="text-[10px] text-gray-400 font-normal">kcal</span>
            </span>
          </div>
        </div>

        {/* Right: Camera View Mode Switcher */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onToggleCameraMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/75 border border-slate-700/80 hover:border-pulse-cyan text-xs font-arcade text-gray-300 hover:text-white transition-all backdrop-blur-md"
            title="Cycle Camera View (Dimmed -> Silhouette -> Hidden)"
          >
            <Eye className="w-3.5 h-3.5 text-pulse-cyan" />
            <span>Feed: <span className="font-bold text-white capitalize">{cameraMode}</span></span>
          </button>
        </div>
      </div>

      {/* Paused Overlay Modal */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl flex flex-col items-center">
            <div className="p-3 rounded-full bg-pulse-cyan/10 border border-pulse-cyan/30 text-pulse-cyan mb-4">
              <Pause className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black font-arcade text-white tracking-wider mb-2">
              WORKOUT PAUSED
            </h3>
            <p className="text-xs text-gray-300 max-w-xs mb-6">
              Step back into camera frame or press resume when ready to continue.
            </p>

            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={onPauseToggle}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta font-arcade font-bold text-black shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                RESUME WORKOUT
              </button>

              <button
                onClick={onRestart}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-arcade text-xs font-semibold text-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restart Session
              </button>

              <button
                onClick={onExit}
                className="w-full py-2.5 rounded-xl bg-transparent hover:bg-red-500/10 border border-transparent hover:border-red-500/30 font-arcade text-xs font-semibold text-red-400 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Exit to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
