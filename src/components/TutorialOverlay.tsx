import React from 'react';
import { TutorialStep } from '../types/game';
import { Zap, Sun, Shield, CheckCircle2, Play, X, Sparkles } from 'lucide-react';

interface TutorialOverlayProps {
  step: TutorialStep;
  count: number;
  onSkip: () => void;
  onFinishAndStart: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  step,
  count,
  onSkip,
  onFinishAndStart,
}) => {
  const getStepInfo = () => {
    switch (step) {
      case 'intro':
        return {
          title: 'WELCOME TO KINETIC BLITZ',
          desc: 'Your webcam tracks your body in real-time like a mirror. Let’s learn the 3 core movements!',
          badge: 'GET READY',
          color: 'text-pulse-cyan border-pulse-cyan',
          icon: <Sparkles className="w-5 h-5 text-pulse-cyan" />,
          progressText: 'Starting practice...',
        };
      case 'strike':
        return {
          title: 'MOVE 1: PUNCH PULSE ORBS',
          desc: 'Cyan orbs approach you from depth. Wait for the outer ring to align, then punch forward with speed!',
          badge: 'STRIKE PRACTICE',
          color: 'text-pulse-cyan border-pulse-cyan',
          icon: <Zap className="w-5 h-5 text-pulse-cyan animate-pulse" />,
          progressText: `Orbs Struck: ${count}/2`,
        };
      case 'hold':
        return {
          title: 'MOVE 2: REACH & HOLD SOLAR NODES',
          desc: 'Reach your hand into the drifting golden node and hold it steady until the circle charges and bursts!',
          badge: 'MOBILITY HOLD',
          color: 'text-pulse-gold border-pulse-gold',
          icon: <Sun className="w-5 h-5 text-pulse-gold animate-spin-slow" />,
          progressText: count >= 1 ? 'Charge Complete!' : 'Place hand in node & hold',
        };
      case 'dodge':
        return {
          title: 'MOVE 3: FULL-BODY LASER DODGE',
          desc: 'Red warning telegraphs alert you of a barrier! Squat down or lean left/right so your head & torso clear the beam!',
          badge: 'DODGE HAZARD',
          color: 'text-pulse-crimson border-pulse-crimson',
          icon: <Shield className="w-5 h-5 text-pulse-crimson animate-bounce" />,
          progressText: count >= 1 ? 'Laser Dodged!' : 'Squat or lean when laser fires',
        };
      case 'outro':
        return {
          title: 'TUTORIAL COMPLETE!',
          desc: 'You’ve mastered punches, mobility holds, and full-body dodges. Pick your mode and burn calories!',
          badge: 'READY TO PLAY',
          color: 'text-emerald-400 border-emerald-400',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          progressText: '100% Complete',
        };
    }
  };

  const info = getStepInfo();

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-6">
      {/* Top Tutorial Instruction Card */}
      <div className="flex flex-col items-center pointer-events-auto max-w-xl mx-auto w-full">
        <div className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-in slide-in-from-top-3 duration-200">
          {/* Top Skip Button */}
          {step !== 'outro' && (
            <button
              onClick={onSkip}
              className="absolute top-3 right-3 text-xs font-arcade text-gray-400 hover:text-white px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black/60 border border-slate-800 transition-all flex items-center gap-1"
            >
              <span>Skip</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Step Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border bg-black/60 text-xs font-arcade tracking-wider uppercase mb-2">
            {info.icon}
            <span className={info.color}>{info.badge}</span>
          </div>

          {/* Title */}
          <h2 className="text-xl md:text-2xl font-black font-arcade text-white tracking-wider mb-1">
            {info.title}
          </h2>

          {/* Description */}
          <p className="text-xs md:text-sm text-gray-300 max-w-md mx-auto mb-3">
            {info.desc}
          </p>

          {/* Step Progress Indicator */}
          {step !== 'outro' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-pulse-cyan animate-ping" />
              <span className="text-xs font-arcade font-bold text-gray-200">
                {info.progressText}
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
              <button
                onClick={onFinishAndStart}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta font-arcade font-bold text-black shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-black" />
                START REAL WORKOUT
              </button>
              <button
                onClick={onSkip}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-arcade font-bold text-gray-200 transition-all"
              >
                Return to Menu
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Step Dots */}
      {step !== 'outro' && (
        <div className="flex items-center justify-center gap-2 mb-4 pointer-events-auto">
          {(['strike', 'hold', 'dodge'] as TutorialStep[]).map((s, idx) => {
            const stepOrder: Record<TutorialStep, number> = {
              intro: 0,
              strike: 1,
              hold: 2,
              dodge: 3,
              outro: 4,
            };
            const currentIdx = stepOrder[step];
            const targetIdx = stepOrder[s];
            const isActive = currentIdx === targetIdx;
            const isDone = currentIdx > targetIdx;

            return (
              <div
                key={s}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-arcade transition-all ${
                  isActive
                    ? 'border-pulse-cyan bg-pulse-cyan/20 text-white shadow-glow-cyan'
                    : isDone
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-gray-500'
                }`}
              >
                <span>{idx + 1}.</span>
                <span className="capitalize">{s}</span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
