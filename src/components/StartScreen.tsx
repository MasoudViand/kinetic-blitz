import React, { useState } from 'react';
import { GameMode, PostureType, DifficultyLevel, CameraMode } from '../types/game';
import {
  Play,
  ShieldCheck,
  Flame,
  Timer,
  Infinity,
  UserCheck,
  Bot,
  Activity,
  GraduationCap,
  Gauge,
  Camera,
  Video,
  Sparkles,
  EyeOff,
} from 'lucide-react';
import { HistoryModal } from './HistoryModal';

interface StartScreenProps {
  onStart: (mode: GameMode, posturePreference: PostureType, difficulty: DifficultyLevel) => void;
  onStartTutorial: () => void;
  onEnableMock: () => void;
  isMockActive: boolean;
  cameraMode: CameraMode;
  onSelectCameraMode: (mode: CameraMode) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onStartTutorial,
  onEnableMock,
  isMockActive,
  cameraMode,
  onSelectCameraMode,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('quick');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const [posturePref, setPosturePref] = useState<PostureType>('uncalibrated');
  const [showHistory, setShowHistory] = useState(false);

  const modes: { id: GameMode; title: string; desc: string; icon: React.ReactNode; duration: string }[] = [
    {
      id: 'quick',
      title: '60s Quick Burn',
      desc: 'Rapid cardio punching & quick reflex dodges',
      icon: <Flame className="w-5 h-5 text-pulse-cyan" />,
      duration: '1:00',
    },
    {
      id: 'endurance',
      title: '3m Endurance',
      desc: 'Sustained full-body cardio & mobility holds',
      icon: <Timer className="w-5 h-5 text-pulse-gold" />,
      duration: '3:00',
    },
    {
      id: 'endless',
      title: 'Endless Flow',
      desc: 'Continuous workout at your own pace',
      icon: <Infinity className="w-5 h-5 text-pulse-magenta" />,
      duration: '∞',
    },
  ];

  const difficulties: { id: DifficultyLevel; label: string; badge: string; desc: string; color: string }[] = [
    {
      id: 'easy',
      label: 'Easy',
      badge: 'Casual / Warmup',
      desc: 'Slower targets, generous timing & fewer obstacles',
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'medium',
      label: 'Medium',
      badge: 'Standard / Active',
      desc: 'Balanced approach speed & target density',
      color: 'border-pulse-cyan/50 bg-pulse-cyan/10 text-pulse-cyan',
    },
    {
      id: 'hard',
      label: 'Hard',
      badge: 'Intense / Cardio',
      desc: 'Fast approaching orbs, frequent dodges & holds',
      color: 'border-rose-500/50 bg-rose-500/10 text-rose-400',
    },
  ];

  const cameraModes: { id: CameraMode; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'dimmed',
      label: 'Mirror',
      desc: 'Live webcam with cyber HUD',
      icon: <Video className="w-3.5 h-3.5 text-pulse-cyan" />,
    },
    {
      id: 'silhouette',
      label: 'Silhouette',
      desc: 'Neon wireframe on cyber grid',
      icon: <Sparkles className="w-3.5 h-3.5 text-pulse-magenta" />,
    },
    {
      id: 'hidden',
      label: 'Cyber Grid',
      desc: 'Pure HUD, camera video hidden',
      icon: <EyeOff className="w-3.5 h-3.5 text-pulse-gold" />,
    },
  ];

  return (
    <>
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 md:p-6 bg-[#0a0e17]/90 backdrop-blur-md overflow-y-auto">
        {/* Background Neon Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pulse-cyan/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pulse-magenta/15 rounded-full blur-3xl pointer-events-none" />

        {/* Main Container */}
        <div className="relative max-w-xl w-full my-auto flex flex-col items-center text-center">
          {/* Title Header */}
          <div className="mb-5 flex flex-col items-center text-center w-full">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pulse-cyan/30 bg-pulse-cyan/10 text-pulse-cyan text-xs font-semibold tracking-wider uppercase mb-2">
              <span className="w-2 h-2 rounded-full bg-pulse-cyan animate-pulse" />
              Webcam Fitness Exergame
            </div>
            <h1 className="text-4xl md:text-5xl font-black font-arcade tracking-wider bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta bg-clip-text text-transparent drop-shadow-md">
              KINETIC PULSE
            </h1>
            <p className="text-gray-300 text-xs md:text-sm mt-2 max-w-md mx-auto text-center leading-relaxed">
              Strike approaching pseudo-3D orbs, reach & hold mobility nodes, and dodge laser barriers calibrated to your body.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 w-full mb-4">
            {modes.map((m) => {
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border transition-all text-left relative overflow-hidden ${
                    isSelected
                      ? 'border-pulse-cyan bg-pulse-cyan/15 shadow-glow-cyan'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="p-1.5 rounded-lg bg-black/40">{m.icon}</div>
                    <span className="text-xs font-bold font-arcade text-gray-400">{m.duration}</span>
                  </div>
                  <div className="font-arcade font-bold text-xs md:text-sm text-white mb-0.5">{m.title}</div>
                  <div className="text-[11px] text-gray-400 leading-tight">{m.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Difficulty Level Selector */}
          <div className="w-full p-3 rounded-xl border border-slate-800 bg-slate-900/60 mb-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-pulse-cyan" />
                <span className="text-xs font-bold text-gray-200">Difficulty Level</span>
              </div>
              <span className="text-[11px] text-gray-400">Controls target speed & spawn density</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {difficulties.map((d) => {
                const isSelected = selectedDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDifficulty(d.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? `${d.color} shadow-sm font-bold`
                        : 'border-slate-800 bg-black/40 text-gray-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-arcade font-bold">{d.label}</span>
                    </div>
                    <span className="text-[10px] opacity-80 mt-1 line-clamp-1">{d.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera View Mode Settings */}
          <div className="w-full p-3 rounded-xl border border-slate-800 bg-slate-900/60 mb-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-pulse-cyan" />
                <span className="text-xs font-bold text-gray-200">Camera & Visuals</span>
              </div>
              <span className="text-[11px] text-gray-400">Display & privacy mode</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {cameraModes.map((cm) => {
                const isSelected = cameraMode === cm.id;
                return (
                  <button
                    key={cm.id}
                    onClick={() => onSelectCameraMode(cm.id)}
                    className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-pulse-cyan bg-pulse-cyan/15 text-pulse-cyan shadow-sm font-bold'
                        : 'border-slate-800 bg-black/40 text-gray-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {cm.icon}
                      <span className="text-xs font-arcade font-bold">{cm.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 leading-tight">{cm.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posture Preference */}
          <div className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 mb-4">
            <div className="flex items-center gap-2 text-left">
              <UserCheck className="w-4 h-4 text-pulse-cyan" />
              <div>
                <div className="text-xs font-bold text-gray-200">Posture Calibration</div>
                <div className="text-[10px] text-gray-400">Lock-in before playing</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg">
              {(
                [
                  { id: 'uncalibrated', label: 'Auto-Detect' },
                  { id: 'standing', label: 'Standing' },
                  { id: 'seated', label: 'Seated' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPosturePref(p.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    posturePref === p.id
                      ? 'bg-pulse-cyan text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Start Workout + Tutorial + History */}
          <div className="flex flex-col gap-2 w-full mb-4">
            <button
              onClick={() => onStart(selectedMode, posturePref, selectedDifficulty)}
              className="w-full py-3.5 px-8 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta hover:opacity-95 active:scale-[0.99] font-arcade font-bold text-base md:text-lg text-black shadow-glow-cyan transition-all flex items-center justify-center gap-2.5 group"
            >
              <Play className="w-5 h-5 fill-black transition-transform group-hover:scale-110" />
              START WORKOUT
            </button>

            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                onClick={onStartTutorial}
                className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-arcade font-semibold text-gray-200 transition-all flex items-center justify-center gap-2 hover:border-pulse-cyan"
              >
                <GraduationCap className="w-4 h-4 text-pulse-cyan" />
                How to Play / Tutorial
              </button>

              <button
                onClick={() => setShowHistory(true)}
                className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-arcade font-semibold text-gray-200 transition-all flex items-center justify-center gap-2 hover:border-pulse-gold"
              >
                <Activity className="w-4 h-4 text-pulse-gold" />
                Workout History & Stats
              </button>
            </div>
          </div>

          {/* Privacy & Mock Mode Links */}
          <div className="flex flex-col sm:flex-row items-center justify-between w-full text-xs text-gray-400 gap-2">
            <div className="flex items-center gap-1.5 text-gray-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% on-device vision. Zero video leaves browser.</span>
            </div>

            <button
              onClick={onEnableMock}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all ${
                isMockActive
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-800 hover:border-slate-700 text-gray-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isMockActive ? 'Mock Pose Active' : 'Test Without Camera'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
    </>
  );
};
