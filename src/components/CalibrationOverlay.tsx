import React, { useEffect, useState, useRef } from 'react';
import { PostureType, CalibrationData } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { CheckCircle2, User, Armchair, RefreshCw } from 'lucide-react';

interface CalibrationOverlayProps {
  detectedPosture: PostureType;
  calibration: CalibrationData;
  onComplete: (confirmedPosture: PostureType) => void;
  onManualOverride: (posture: PostureType) => void;
}

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  detectedPosture,
  onComplete,
  onManualOverride,
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const [currentPosture, setCurrentPosture] = useState<PostureType>(detectedPosture === 'uncalibrated' ? 'standing' : detectedPosture);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const currentPostureRef = useRef(currentPosture);
  currentPostureRef.current = currentPosture;

  useEffect(() => {
    if (detectedPosture !== 'uncalibrated') {
      setCurrentPosture(detectedPosture);
    }
  }, [detectedPosture]);

  useEffect(() => {
    soundEngine.playCountdown(false);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          soundEngine.playCountdown(true);
          onCompleteRef.current(currentPostureRef.current);
          return 0;
        }
        soundEngine.playCountdown(false);
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const togglePosture = () => {
    const next = currentPosture === 'standing' ? 'seated' : 'standing';
    setCurrentPosture(next);
    onManualOverride(next);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-3 sm:p-6 md:p-8 pointer-events-none overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col items-center text-center mt-2 sm:mt-4 shrink-0">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full border border-pulse-cyan/40 bg-black/60 backdrop-blur-md text-pulse-cyan text-[10px] sm:text-xs font-arcade tracking-widest uppercase mb-1.5 sm:mb-2">
          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
          Body Calibration Lock-On
        </div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-arcade font-bold text-white tracking-wider">
          STEP INTO FRAME
        </h2>
        <p className="text-[11px] sm:text-xs md:text-sm text-gray-300 max-w-xs sm:max-w-sm mt-1 px-2">
          Position your shoulders and hands inside view. Spawns are dynamically scaling to your reach.
        </p>
      </div>

      {/* Center Holographic Target Frame */}
      <div className="relative flex flex-col items-center justify-center my-auto py-2 sm:py-4">
        {/* Hologram Circle */}
        <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full border-2 border-dashed border-pulse-cyan/40 flex items-center justify-center animate-spin-slow">
          <div className="w-36 h-36 sm:w-52 sm:h-52 md:w-64 md:h-64 rounded-full border border-pulse-cyan/20" />
        </div>

        {/* Center Countdown Digit */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-5xl sm:text-7xl md:text-8xl font-black font-arcade text-pulse-cyan drop-shadow-lg text-glow-cyan animate-pulse">
            {countdown > 0 ? countdown : 'GO!'}
          </span>
        </div>
      </div>

      {/* Bottom Posture Status & Manual Switch (pointer-events enabled) */}
      <div className="pointer-events-auto flex flex-col items-center gap-2 sm:gap-3 mb-2 sm:mb-6 shrink-0">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-black/75 border border-slate-700 backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium">Posture:</span>
            <span className="text-[11px] sm:text-xs font-arcade font-bold uppercase tracking-wider text-pulse-cyan">
              {currentPosture} Mode
            </span>
          </div>

          <button
            onClick={togglePosture}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] sm:text-xs font-semibold text-gray-200 transition-all border border-slate-600 active:scale-95 cursor-pointer"
            title="Switch between Standing and Seated mode"
          >
            {currentPosture === 'standing' ? (
              <>
                <Armchair className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pulse-gold" />
                <span>Switch to Seated</span>
              </>
            ) : (
              <>
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pulse-cyan" />
                <span>Switch to Standing</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
