import React, { useState, useEffect, useCallback } from 'react';
import { GameMode, DifficultyLevel } from '../types/game';
import { xrStore, VrScene } from './VrScene';
import { soundEngine } from '../audio/soundEngine';
import {
  Flame,
  Timer,
  Infinity as InfinityIcon,
  Glasses,
  Eye,
  ArrowLeft,
  Layers,
  MonitorPlay,
  Info,
} from 'lucide-react';

export const VrLauncherView: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('quick');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('medium');
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  const [supportsAr, setSupportsAr] = useState<boolean | null>(null);
  const [supportsVr, setSupportsVr] = useState<boolean | null>(null);
  const [isCheckingXR, setIsCheckingXR] = useState<boolean>(true);

  // Check WebXR device support
  useEffect(() => {
    let mounted = true;
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr) {
      Promise.all([
        navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
        navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
      ]).then(([ar, vr]) => {
        if (!mounted) return;
        setSupportsAr(!!ar);
        setSupportsVr(!!vr);
        setIsCheckingXR(false);
      });
    } else {
      setSupportsAr(false);
      setSupportsVr(false);
      setIsCheckingXR(false);
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Listen to xrStore session state
  useEffect(() => {
    return xrStore.subscribe((state) => {
      if (state.session) {
        setIsSessionActive(true);
      } else {
        setIsSessionActive(false);
      }
    });
  }, []);

  const handleLaunchAR = useCallback(async () => {
    soundEngine.enableAudio();
    setIsSessionActive(true);
    try {
      await xrStore.enterAR();
    } catch (err) {
      console.warn('[WebXR] Enter AR error:', err);
    }
  }, []);

  const handleLaunchVR = useCallback(async () => {
    soundEngine.enableAudio();
    setIsSessionActive(true);
    try {
      await xrStore.enterVR();
    } catch (err) {
      console.warn('[WebXR] Enter VR error:', err);
    }
  }, []);

  const handleLaunchEmulator = useCallback(async () => {
    soundEngine.enableAudio();
    setIsSessionActive(true);
    try {
      await xrStore.enterVR();
    } catch (err) {
      console.warn('[WebXR] Emulator launch error:', err);
    }
  }, []);

  const handleReturnTo2D = () => {
    window.location.href = '/';
  };

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
      icon: <InfinityIcon className="w-5 h-5 text-pulse-magenta" />,
      duration: '∞',
    },
  ];

  const difficulties: { id: DifficultyLevel; label: string; badge: string; desc: string; color: string }[] = [
    {
      id: 'easy',
      label: 'Easy',
      badge: 'Casual / Warmup',
      desc: 'Slower targets, generous strike timing',
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

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#070b14] text-white flex flex-col items-center justify-center select-none font-sans">
      {/* 3D Scene (Always mounted so WebXR session canvas is ready) */}
      <VrScene
        mode={selectedMode}
        difficulty={selectedDifficulty}
        onExitSession={() => setIsSessionActive(false)}
      />

      {/* 2D Launcher Overlay: Only visible when NOT inside an active headset session */}
      {!isSessionActive && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 bg-[#070b14]/90 backdrop-blur-md overflow-y-auto overscroll-contain">
          {/* Background Ambient Glows */}
          <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-pulse-cyan/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-pulse-magenta/15 rounded-full blur-3xl pointer-events-none" />

          {/* Main Container */}
          <div className="relative max-w-xl w-full my-auto flex flex-col items-center text-center py-4">
            {/* Back to 2D Mode Button */}
            <div className="w-full flex items-center justify-between mb-3">
              <button
                onClick={handleReturnTo2D}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Webcam Mode</span>
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-pulse-cyan/40 bg-pulse-cyan/10 text-pulse-cyan text-[11px] font-semibold tracking-wide uppercase">
                <Glasses className="w-3.5 h-3.5 animate-pulse" />
                <span>Meta Quest 3 WebXR</span>
              </div>
            </div>

            {/* Title Header */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-arcade tracking-wider bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta bg-clip-text text-transparent drop-shadow-md">
              KINETIC BLITZ VR
            </h1>
            <p className="text-gray-300 text-xs sm:text-sm mt-1.5 max-w-md mx-auto text-center leading-relaxed">
              True 6DoF shadowboxing exergame with color passthrough, controller haptics, and native 90 FPS physics.
            </p>

            {/* 1. Mode Selector */}
            <div className="w-full mt-5">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 text-left">
                Select Workout Duration
              </div>
              <div className="grid grid-cols-3 gap-2">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMode(m.id)}
                    className={`flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedMode === m.id
                        ? 'border-pulse-cyan bg-pulse-cyan/15 text-white shadow-glow-cyan'
                        : 'border-slate-800 bg-slate-900/60 text-gray-400 hover:border-slate-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="mb-1">{m.icon}</div>
                    <div className="font-arcade text-xs font-bold text-white mb-0.5">{m.title}</div>
                    <div className="text-[10px] text-gray-400 line-clamp-1">{m.duration}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Difficulty Selector */}
            <div className="w-full mt-4">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 text-left">
                Difficulty Level
              </div>
              <div className="grid grid-cols-3 gap-2">
                {difficulties.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDifficulty(d.id)}
                    className={`flex flex-col items-center justify-between p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      selectedDifficulty === d.id
                        ? `${d.color} shadow-sm font-bold`
                        : 'border-slate-800 bg-slate-900/60 text-gray-400 hover:border-slate-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="font-arcade text-xs">{d.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{d.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Primary WebXR Launch Buttons */}
            <div className="w-full mt-6 flex flex-col gap-2.5">
              {/* Primary CTA: Mixed Reality Passthrough */}
              <button
                onClick={handleLaunchAR}
                className="w-full py-3.5 px-4 rounded-xl font-arcade text-sm sm:text-base font-bold tracking-wide uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer bg-gradient-to-r from-pulse-cyan via-teal-400 to-pulse-cyan text-slate-950 hover:brightness-110 shadow-glow-cyan transform hover:-translate-y-0.5"
              >
                <Eye className="w-5 h-5 text-slate-950" />
                <span>Enter Mixed Reality (Passthrough)</span>
              </button>

              {/* Secondary CTA: VR Arena Cyber Grid */}
              <button
                onClick={handleLaunchVR}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-arcade text-xs sm:text-sm font-bold tracking-wide uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer bg-slate-800/90 hover:bg-slate-700/90 border border-pulse-magenta/50 text-pulse-magenta hover:text-white shadow-glow-magenta"
              >
                <Layers className="w-4 h-4 text-pulse-magenta" />
                <span>Enter VR Arena (Cyber Grid)</span>
              </button>

              {/* VR Arena Roomscale boundary guidance */}
              <p className="text-[11px] text-gray-400 text-center px-2 py-0.5 leading-snug">
                For full dodging &amp; squatting in VR Arena, set your Quest boundary to <strong>Roomscale</strong> (or use Mixed Reality Passthrough).
              </p>
            </div>

            {/* WebXR Hardware Status or Desktop Fallback */}
            <div className="w-full mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-gray-300 text-left">
              <div className="flex items-center gap-2 mb-1.5 font-semibold text-gray-200">
                <Info className="w-4 h-4 text-pulse-cyan shrink-0" />
                <span>Quest 3 Quick Setup Guide:</span>
              </div>
              <ul className="space-y-1 text-gray-400 ml-5 list-disc">
                <li>Put on your Meta Quest 3 headset and launch <strong>Meta Quest Browser</strong>.</li>
                <li>Controllers provide 6DoF haptics; bare hands are also tracked automatically.</li>
                <li>In game: <strong>[B / Y]</strong> Pause · <strong>[Thumbstick]</strong> Recenter · <strong>[A / X]</strong> Recalibrate.</li>
                <li>In pause menu: <strong>[A / X]</strong> Resume · <strong>[Grip]</strong> Restart · <strong>[B / Y]</strong> Stop &amp; Exit.</li>
              </ul>

              {/* Notice if not in XR browser */}
              {!supportsAr && !supportsVr && !isCheckingXR && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span className="text-amber-400 text-[10px] sm:text-[11px]">
                    No WebXR headset detected on this browser.
                  </span>

                  {import.meta.env.DEV && (
                    <button
                      onClick={handleLaunchEmulator}
                      className="px-2.5 py-1 rounded bg-pulse-cyan/20 border border-pulse-cyan/40 text-pulse-cyan hover:bg-pulse-cyan/30 text-[11px] font-arcade font-bold cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <MonitorPlay className="w-3.5 h-3.5" />
                      <span>Launch Desktop XR Emulator</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VrLauncherView;
