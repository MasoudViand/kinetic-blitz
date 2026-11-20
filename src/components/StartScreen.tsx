import React, { useState } from 'react';
import { GameMode, PostureType } from '../types/game';
import { Play, ShieldCheck, Flame, Timer, Infinity, UserCheck, Bot } from 'lucide-react';

interface StartScreenProps {
  onStart: (mode: GameMode, posturePreference: PostureType) => void;
  onEnableMock: () => void;
  isMockActive: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onEnableMock,
  isMockActive,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('quick');
  const [posturePref, setPosturePref] = useState<PostureType>('uncalibrated');

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

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-[#0a0e17]/90 backdrop-blur-md">
      {/* Background Neon Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pulse-cyan/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pulse-magenta/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-xl w-full flex flex-col items-center text-center">
        {/* Title */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pulse-cyan/30 bg-pulse-cyan/10 text-pulse-cyan text-xs font-semibold tracking-wider uppercase mb-3">
            <span className="w-2 h-2 rounded-full bg-pulse-cyan animate-pulse" />
            Webcam Fitness Exergame
          </div>
          <h1 className="text-5xl md:text-6xl font-black font-arcade tracking-wider bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta bg-clip-text text-transparent drop-shadow-md">
            KINETIC PULSE
          </h1>
          <p className="text-gray-300 text-sm md:text-base mt-2 max-w-md">
            Strike approaching pseudo-3D orbs, reach & hold mobility nodes, and dodge laser barriers calibrated to your body.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mb-6">
          {modes.map((m) => {
            const isSelected = selectedMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMode(m.id)}
                className={`flex flex-col items-start p-4 rounded-xl border transition-all text-left relative overflow-hidden ${
                  isSelected
                    ? 'border-pulse-cyan bg-pulse-cyan/15 shadow-glow-cyan'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="p-2 rounded-lg bg-black/40">{m.icon}</div>
                  <span className="text-xs font-bold font-arcade text-gray-400">{m.duration}</span>
                </div>
                <div className="font-arcade font-bold text-sm text-white mb-1">{m.title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{m.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Posture Preference */}
        <div className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60 mb-6">
          <div className="flex items-center gap-2 text-left">
            <UserCheck className="w-4 h-4 text-pulse-cyan" />
            <div>
              <div className="text-xs font-bold text-gray-200">Posture Calibration</div>
              <div className="text-[11px] text-gray-400">Lock-in before playing</div>
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

        {/* Start Button */}
        <button
          onClick={() => onStart(selectedMode, posturePref)}
          className="w-full py-4 px-8 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta hover:opacity-95 active:scale-[0.99] font-arcade font-bold text-lg text-black shadow-glow-cyan transition-all flex items-center justify-center gap-3 group"
        >
          <Play className="w-6 h-6 fill-black transition-transform group-hover:scale-110" />
          START WORKOUT
        </button>

        {/* Privacy & Mock Mode Links */}
        <div className="mt-5 flex flex-col md:flex-row items-center justify-between w-full text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-1.5 text-gray-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% on-device vision. Zero camera video leaves browser.</span>
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
  );
};
