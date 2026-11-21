import React, { useEffect, useState, useRef } from 'react';
import { PostureType, CalibrationData } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { poseService } from '../vision/poseService';
import { CheckCircle2, User, Armchair, RefreshCw, CameraOff, Camera, ArrowLeft } from 'lucide-react';

interface CalibrationOverlayProps {
  isCameraReady?: boolean;
  permissionDenied?: boolean;
  detectedPosture: PostureType;
  calibration: CalibrationData;
  onComplete: (confirmedPosture: PostureType) => void;
  onManualOverride: (posture: PostureType) => void;
  onRetryCamera?: () => void;
  onExit?: () => void;
  onUseSimulatedPose?: () => void;
}

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  isCameraReady = true,
  permissionDenied = false,
  detectedPosture,
  onComplete,
  onManualOverride,
  onRetryCamera,
  onExit,
  onUseSimulatedPose,
}) => {
  const isSensorReady = (isCameraReady || detectedPosture !== 'uncalibrated' || poseService.isCameraReady) && !permissionDenied;
  const [hasStarted, setHasStarted] = useState<boolean>(isSensorReady);
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
    if (permissionDenied) {
      setHasStarted(false);
      setCountdown(5);
    } else if (isSensorReady && !hasStarted) {
      setHasStarted(true);
    }
  }, [isSensorReady, hasStarted, permissionDenied]);

  useEffect(() => {
    if (!hasStarted) return;

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
  }, [hasStarted]);

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

      {/* Center Content: Permission Denied Card OR Holographic Target Frame */}
      {permissionDenied ? (
        <div className="pointer-events-auto max-w-sm sm:max-w-md w-full mx-4 my-auto p-5 sm:p-6 rounded-2xl bg-black/90 border border-rose-500/50 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center animate-fade-in z-30">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3 shadow-lg shadow-rose-950/40">
            <CameraOff className="w-6 h-6 animate-pulse" />
          </div>

          <div className="text-[10px] font-arcade uppercase tracking-widest text-rose-400 mb-1">
            Permission Required
          </div>
          <h3 className="text-base sm:text-xl font-arcade font-bold text-white mb-2 tracking-wide">
            CAMERA ACCESS NEEDED
          </h3>

          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            Kinetic Blitz tracks body posture and strikes in real-time strictly on-device. Zero video or biometric data ever leaves your browser.
          </p>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-gray-400 mb-5 leading-normal text-left w-full">
            <p className="font-semibold text-gray-200 mb-1">💡 If camera access was blocked:</p>
            <p>Click the camera icon in your browser address bar to set permission to <span className="text-emerald-400 font-semibold">Allow</span>, then click the retry button below.</p>
          </div>

          <div className="flex flex-col w-full gap-2.5">
            {onRetryCamera && (
              <button
                onClick={onRetryCamera}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pulse-cyan to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-arcade font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Ask For Camera Again</span>
              </button>
            )}

            {onUseSimulatedPose && (
              <button
                onClick={onUseSimulatedPose}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700 font-arcade text-[10px] sm:text-[11px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Continue With Simulated Pose</span>
              </button>
            )}

            {onExit && (
              <button
                onClick={onExit}
                className="w-full py-2 px-4 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white font-arcade text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Main Menu</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center my-auto py-2 sm:py-4">
          {/* Hologram Circle */}
          <div className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full border-2 border-dashed border-pulse-cyan/40 flex items-center justify-center animate-spin-slow">
            <div className="w-36 h-36 sm:w-52 sm:h-52 md:w-64 md:h-64 rounded-full border border-pulse-cyan/20" />
          </div>

          {/* Center Countdown Digit */}
          <div className="absolute flex flex-col items-center justify-center">
            {hasStarted ? (
              <span className="text-5xl sm:text-7xl md:text-8xl font-black font-arcade text-pulse-cyan drop-shadow-lg text-glow-cyan animate-pulse">
                {countdown > 0 ? countdown : 'GO!'}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-arcade text-pulse-cyan animate-pulse tracking-widest text-center px-4">
                CONNECTING CAMERA...
              </span>
            )}
          </div>
        </div>
      )}

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
