import React, { useState, useEffect, useRef } from 'react';
import { GameMode, DifficultyLevel, PostureType } from '../types/game';
import { TvControlCommand, TvStateUpdate } from './tvCastService';
import { poseService } from '../vision/poseService';
import {
  Tv,
  Unlink,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Award,
  Sparkles,
  Smartphone,
  User,
  Armchair,
  CheckCircle2,
  Menu,
  CameraOff,
  Camera,
} from 'lucide-react';

interface PhoneRemoteViewProps {
  roomCode: string;
  onDisconnect: () => void;
  detectedPosture: PostureType;
  onTogglePosture: () => void;
  tvState: TvStateUpdate | null;
  onSendCommand: (cmd: TvControlCommand) => void;
  isCameraActive?: boolean;
  onRetryCamera?: () => void;
}

export const PhoneRemoteView: React.FC<PhoneRemoteViewProps> = ({
  roomCode,
  onDisconnect,
  detectedPosture,
  onTogglePosture,
  tvState,
  onSendCommand,
  isCameraActive = true,
  onRetryCamera,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('quick');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const phase = tvState?.phase || 'idle';

  useEffect(() => {
    const attachStream = () => {
      const stream = poseService.getStream();
      if (previewVideoRef.current && stream && previewVideoRef.current.srcObject !== stream) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }
    };
    attachStream();
    const interval = setInterval(attachStream, 300);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined || !isFinite(seconds) || seconds < 0) return '∞';
    const totalSecs = Math.max(0, Math.floor(seconds));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#070b12] text-white flex flex-col justify-start p-3 sm:p-5 select-none z-50">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-pulse-cyan/15 border border-pulse-cyan/30 text-pulse-cyan">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-arcade uppercase text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TV Sensor Mode</span>
              <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                {roomCode}
              </span>
            </div>
            <h1 className="text-xs sm:text-sm font-black font-arcade tracking-wider text-gray-200">
              KINETIC BLITZ REMOTE
            </h1>
          </div>
        </div>

        <button
          onClick={onDisconnect}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[10px] sm:text-xs font-arcade font-bold cursor-pointer transition-all"
        >
          <Unlink className="w-3.5 h-3.5" />
          <span>Disconnect</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col gap-3 my-2.5 max-w-md mx-auto w-full">
        {/* Live Camera View with Sensor Framing Guide */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-slate-700 bg-black/60 shadow-lg flex items-center justify-center shrink-0">
          <video
            ref={previewVideoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-75"
          />

          {/* Framing Guide Hologram Box */}
          <div className="absolute inset-4 rounded-xl border border-dashed border-pulse-cyan/40 pointer-events-none flex flex-col items-center justify-between p-2">
            <span className="text-[9px] font-arcade uppercase tracking-wider text-pulse-cyan bg-black/60 px-2 py-0.5 rounded-full border border-pulse-cyan/30">
              Pose Framing Zone
            </span>
            <span className="text-[9px] text-gray-300 bg-black/70 px-2 py-0.5 rounded-md text-center max-w-[200px]">
              Keep head & hands visible to phone camera
            </span>
          </div>

          {/* Camera Permission Needed Overlay on Phone Remote */}
          {!isCameraActive && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-3 text-center">
              <CameraOff className="w-6 h-6 sm:w-8 sm:h-8 text-rose-400 mb-1.5 animate-pulse" />
              <span className="text-[11px] sm:text-xs font-arcade font-bold text-white mb-0.5">CAMERA ACCESS NEEDED</span>
              <span className="text-[9px] sm:text-[10px] text-gray-300 mb-2.5 max-w-[220px]">
                Camera stream is required to track poses for the TV.
              </span>
              {onRetryCamera && (
                <button
                  onClick={onRetryCamera}
                  className="px-3 py-1.5 rounded-lg bg-pulse-cyan text-black font-arcade font-bold text-[10px] uppercase cursor-pointer hover:bg-cyan-300 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Enable Camera</span>
                </button>
              )}
            </div>
          )}

          {/* Posture Badge Pill on Camera Feed */}
          <div className="absolute bottom-2 left-2 z-10 pointer-events-auto">
            <button
              onClick={onTogglePosture}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black border border-slate-700 text-[10px] font-arcade font-bold text-pulse-cyan transition-all cursor-pointer backdrop-blur-md"
              title="Click to toggle Standing or Seated mode"
            >
              {detectedPosture === 'standing' ? (
                <>
                  <User className="w-3 h-3 text-pulse-cyan" />
                  <span>Standing Mode</span>
                </>
              ) : (
                <>
                  <Armchair className="w-3 h-3 text-pulse-gold" />
                  <span>Seated Mode</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Phase-Dependent Remote Controls */}

        {/* 1. IDLE / MENU PHASE: Select mode and Start */}
        {phase === 'idle' && (
          <div className="flex flex-col gap-2.5">
            {/* Mode Selectors */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-arcade uppercase text-gray-400 tracking-wider">
                Select Game Mode:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'quick', label: '60s Blitz', time: '1:00' },
                  { id: 'endurance', label: '3m Endure', time: '3:00' },
                  { id: 'endless', label: 'Endless', time: '∞' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMode(m.id as GameMode)}
                    className={`py-2 px-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedMode === m.id
                        ? 'border-pulse-cyan bg-pulse-cyan/20 text-white font-bold shadow-glow-cyan'
                        : 'border-slate-800 bg-slate-900/60 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-arcade font-bold">{m.time}</div>
                    <div className="text-[9px] uppercase tracking-wider">{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selectors */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-arcade uppercase text-gray-400 tracking-wider">
                Select Difficulty:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'easy', label: 'Casual', color: 'text-emerald-400' },
                  { id: 'medium', label: 'Standard', color: 'text-pulse-cyan' },
                  { id: 'hard', label: 'Intense', color: 'text-rose-400' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDifficulty(d.id as DifficultyLevel)}
                    className={`py-1.5 rounded-lg border text-center text-xs font-arcade capitalize transition-all cursor-pointer ${
                      selectedDifficulty === d.id
                        ? 'border-white bg-white/10 text-white font-bold'
                        : 'border-slate-800 bg-slate-900/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className={d.color}>{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Big Start Button */}
            <button
              onClick={() => onSendCommand({ type: 'START_GAME', mode: selectedMode, difficulty: selectedDifficulty })}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta font-arcade font-black text-sm text-black shadow-glow-cyan hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>START WORKOUT ON TV</span>
            </button>

            {/* Tutorial Button */}
            <button
              onClick={() => onSendCommand({ type: 'START_TUTORIAL' })}
              className="w-full py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-arcade text-gray-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-pulse-cyan" />
              <span>How to Play / Practice Tutorial</span>
            </button>
          </div>
        )}

        {/* 2. CALIBRATION / COUNTDOWN PHASE */}
        {(phase === 'calibrating' || phase === 'countdown') && (
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/60 border border-pulse-cyan/40 text-center gap-2 animate-pulse">
            <Sparkles className="w-8 h-8 text-pulse-cyan animate-spin" />
            <h3 className="font-arcade font-bold text-sm text-white tracking-wider">
              LOOK AT YOUR TV SCREEN
            </h3>
            <p className="text-[11px] text-gray-300 max-w-xs">
              Step into camera view facing your TV. Body reach calibration is locking on!
            </p>
            <button
              onClick={() => onSendCommand({ type: 'EXIT_TO_MENU' })}
              className="mt-2 py-1.5 px-4 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-arcade text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              Cancel Calibration
            </button>
          </div>
        )}

        {/* 3. ACTIVE GAMEPLAY PHASE */}
        {phase === 'playing' && tvState && (
          <div className="flex flex-col gap-2.5">
            {/* Live Stats Telemetry Bar */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div>
                <span className="text-[9px] font-arcade uppercase text-gray-400">Score</span>
                <div className="text-xl font-black font-arcade text-white tracking-wider">
                  {tvState.score.toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-arcade uppercase text-gray-400">Time</span>
                <div className="text-xl font-black font-arcade text-pulse-cyan font-mono">
                  {formatTime(tvState.timeRemaining)}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-arcade uppercase text-gray-400 flex items-center justify-center gap-0.5">
                  <Flame className="w-3 h-3 text-amber-400" /> Kcal
                </span>
                <div className="text-xl font-black font-arcade text-amber-400">
                  {tvState.caloriesBurned}
                </div>
              </div>
            </div>

            {tvState.combo > 1 && (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-black/40 border border-pulse-cyan/30 text-xs font-arcade text-pulse-cyan">
                <Award className="w-4 h-4 text-pulse-cyan animate-pulse" />
                <span>COMBO: <strong>{tvState.combo}x</strong></span>
              </div>
            )}

            {/* Pause Button */}
            <button
              onClick={() => onSendCommand({ type: 'PAUSE' })}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-pulse-gold text-pulse-gold font-arcade font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-glow-gold transition-all"
            >
              <Pause className="w-4 h-4 fill-pulse-gold" />
              <span>PAUSE WORKOUT ON TV</span>
            </button>
          </div>
        )}

        {/* 4. PAUSED PHASE */}
        {phase === 'paused' && (
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-black/70 border border-pulse-gold text-center">
            <h3 className="font-arcade font-bold text-sm text-pulse-gold tracking-widest uppercase">
              Workout Paused on TV
            </h3>
            <p className="text-[11px] text-gray-300 mb-2">
              Catch your breath. Tap resume when ready!
            </p>

            <button
              onClick={() => onSendCommand({ type: 'RESUME' })}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta font-arcade font-bold text-xs text-black shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>RESUME WORKOUT</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => onSendCommand({ type: 'RESTART' })}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-arcade font-semibold text-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              <button
                onClick={() => onSendCommand({ type: 'EXIT_TO_MENU' })}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-arcade font-semibold text-gray-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>Exit Menu</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. SUMMARY / GAME OVER PHASE */}
        {phase === 'game_over' && tvState && (
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-black/70 border border-pulse-cyan text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-pulse-gold font-arcade text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>WORKOUT COMPLETE</span>
            </div>
            <div className="text-2xl font-black font-arcade text-white">
              {tvState.score.toLocaleString()} <span className="text-xs text-gray-400">PTS</span>
            </div>

            <button
              onClick={() => onSendCommand({ type: 'START_GAME', mode: selectedMode, difficulty: selectedDifficulty })}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta font-arcade font-bold text-xs text-black shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              <RotateCcw className="w-4 h-4" />
              <span>PLAY AGAIN ON TV</span>
            </button>

            <button
              onClick={() => onSendCommand({ type: 'EXIT_TO_MENU' })}
              className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-arcade text-gray-300 transition-all cursor-pointer"
            >
              Change Mode / Main Menu
            </button>
          </div>
        )}

        {/* 6. TUTORIAL PHASE */}
        {phase === 'tutorial' && (
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-black/70 border border-pulse-cyan text-center">
            <span className="text-xs font-arcade text-pulse-cyan uppercase">
              Tutorial Practice Active on TV
            </span>
            <p className="text-[11px] text-gray-300">
              Practice punches, holds, and dodges on your TV screen.
            </p>
            <button
              onClick={() => onSendCommand({ type: 'SKIP_TUTORIAL' })}
              className="w-full py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-arcade text-gray-200 transition-all cursor-pointer"
            >
              Exit Tutorial to Menu
            </button>
          </div>
        )}

        {/* Bottom Placement Advice Pill */}
        <div className="mt-auto p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2 text-[10px] text-gray-400">
          <Smartphone className="w-4 h-4 text-pulse-cyan shrink-0 mt-0.5" />
          <span>
            <strong>Phone Placement:</strong> Place phone horizontally below your TV screen facing your play area so the camera has a clear view of your body.
          </span>
        </div>
      </div>
    </div>
  );
};
