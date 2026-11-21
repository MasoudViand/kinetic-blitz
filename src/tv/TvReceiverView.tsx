import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'react-qr-code';
import {
  TvReceiverSession,
  generateRoomCode,
  TvControlCommand,
  TvStateUpdate,
} from './tvCastService';
import { remotePoseProvider } from '../vision/remotePoseProvider';
import { GameEngine } from '../engine/gameEngine';
import { canvasRenderer } from '../renderer/canvasRenderer';
import { postureDetector } from '../vision/postureDetector';
import { soundEngine } from '../audio/soundEngine';
import { getFistPosition } from '../vision/handTracking';
import { GameMode, GameState, DifficultyLevel, PostureType, TutorialStep, PlayerStats, Landmark3D, Point2D } from '../types/game';

import { CalibrationOverlay } from '../components/CalibrationOverlay';
import { SummaryModal } from '../components/SummaryModal';
import { TutorialOverlay } from '../components/TutorialOverlay';

import {
  Tv,
  Volume2,
  Smartphone,
  ShieldCheck,
  Maximize2,
  RefreshCw,
  Flame,
} from 'lucide-react';

export const TvReceiverView: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());
  const sessionRef = useRef<TvReceiverSession | null>(null);
  const soundButtonRef = useRef<HTMLButtonElement | null>(null);
  const landmarksRef = useRef<Landmark3D[] | null>(null);

  // Local TV Game States
  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameMode>('quick');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [detectedPosture, setDetectedPosture] = useState<PostureType>('standing');
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [stats, setStats] = useState<PlayerStats>(engineRef.current.stats);

  const [isTutorial, setIsTutorial] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('intro');
  const [tutorialCount, setTutorialCount] = useState<number>(0);

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.replace(/\/tv\/?$/, '')}/?tv=${roomCode}`
    : '';

  // Unlock sound via interaction (TV remote or touch)
  const handleEnableSound = useCallback(() => {
    soundEngine.enableAudio();
    setSoundEnabled(true);
  }, []);

  // Listen to remote TV OK/Enter key or Space to unlock sound or resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) {
        if (!soundEnabled) {
          handleEnableSound();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, handleEnableSound]);

  // Synchronize engine state callbacks
  useEffect(() => {
    const engine = engineRef.current;
    engine.onStateChange = (newState) => {
      setGameState(newState);
    };
    engine.onStatsUpdate = (newStats) => {
      setStats({ ...newStats });
      setTimeRemaining(engine.timeRemaining);
    };
    engine.onTutorialStepChange = (step, count) => {
      setTutorialStep(step);
      setTutorialCount(count);
    };
  }, []);

  // Handle incoming control commands from Phone
  const handleControlCommand = useCallback((cmd: TvControlCommand) => {
    const engine = engineRef.current;

    switch (cmd.type) {
      case 'START_GAME':
        setGameMode(cmd.mode);
        setDifficulty(cmd.difficulty);
        setIsTutorial(false);
        postureDetector.resetCalibration();
        engine.difficulty = cmd.difficulty;
        engine.state = 'calibrating';
        setGameState('calibrating');
        break;
      case 'PAUSE':
        engine.pauseSession();
        break;
      case 'RESUME':
        engine.resumeSession();
        break;
      case 'RESTART':
        if (isTutorial) {
          engine.startTutorial(engine.calibration);
        } else {
          engine.startSession(gameMode, engine.calibration, difficulty);
        }
        break;
      case 'EXIT_TO_MENU':
        engine.state = 'idle';
        setIsTutorial(false);
        setGameState('idle');
        break;
      case 'SET_POSTURE':
        setDetectedPosture(cmd.posture);
        engine.calibration.posture = cmd.posture;
        break;
      case 'START_TUTORIAL':
        setIsTutorial(true);
        postureDetector.resetCalibration();
        engine.state = 'calibrating';
        setGameState('calibrating');
        break;
      case 'SKIP_TUTORIAL':
        setIsTutorial(false);
        engine.state = 'idle';
        setGameState('idle');
        break;
    }
  }, [detectedPosture, isTutorial, gameMode, difficulty]);

  // Push periodic state updates to Phone (~10Hz)
  const pushStateUpdate = useCallback(() => {
    if (!sessionRef.current || !isConnected) return;

    const engine = engineRef.current;
    const update: TvStateUpdate = {
      phase: engine.state,
      score: engine.stats.score,
      combo: engine.stats.combo,
      maxCombo: engine.stats.maxCombo,
      timeRemaining: Math.max(0, Math.floor(engine.timeRemaining)),
      caloriesBurned: Math.round(engine.stats.caloriesBurned),
      postureMode: detectedPosture,
      difficulty,
      mode: gameMode,
      isPresent: remotePoseProvider.isPresent,
      tvFps: remotePoseProvider.fps,
      summary: engine.state === 'game_over' ? {
        score: engine.stats.score,
        rank: engine.stats.score > 8000 ? 'S' : engine.stats.score > 4000 ? 'A' : 'B',
        pulseHits: engine.stats.pulseHits,
        solarHolds: engine.stats.solarHolds,
        lasersDodged: engine.stats.lasersDodged,
        maxCombo: engine.stats.maxCombo,
        caloriesBurned: Math.round(engine.stats.caloriesBurned),
      } : undefined,
    };

    sessionRef.current.sendStateUpdate(update);
  }, [isConnected, detectedPosture, difficulty, gameMode]);

  useEffect(() => {
    if (!isConnected) return;
    pushStateUpdate();
    const interval = setInterval(pushStateUpdate, 100);
    return () => clearInterval(interval);
  }, [isConnected, pushStateUpdate]);

  // Subscribe to Remote Pose Stream
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = remotePoseProvider.subscribe((landmarks) => {
      landmarksRef.current = landmarks;
      const engine = engineRef.current;
      const now = performance.now();

      // Check Presence & Auto-Pause on TV
      const isPresent = postureDetector.checkPresence(landmarks);

      if (engine.state === 'playing' || engine.state === 'tutorial') {
        postureDetector.handlePresenceTracking(isPresent, now, () => {
          engine.pauseSession();
        });
      }

      // Handle Calibration Phase
      if (engine.state === 'calibrating' && landmarks && isPresent) {
        postureDetector.addCalibrationSample(landmarks);
        const currentPosture = postureDetector.classifyPosture(landmarks);
        setDetectedPosture(currentPosture);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected]);

  // Main 60 FPS TV Canvas Render Loop
  useEffect(() => {
    if (!isConnected) return;

    let animId: number;

    const renderLoop = (time: number) => {

      const canvas = canvasRef.current;
      const engine = engineRef.current;
      const landmarks = landmarksRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Resize canvas to match display client dimensions
          const dpr = window.devicePixelRatio || 1;
          const displayWidth = canvas.clientWidth;
          const displayHeight = canvas.clientHeight;

          if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
          }

          ctx.save();
          ctx.scale(dpr, dpr);

          let leftWrist: Point2D | null = null;
          let rightWrist: Point2D | null = null;
          let nose: Point2D | null = null;
          let shoulderCenter: Point2D | null = null;

          if (landmarks) {
            leftWrist = getFistPosition(landmarks, 'left');
            rightWrist = getFistPosition(landmarks, 'right');
            if (landmarks[0]) nose = { x: landmarks[0].x, y: landmarks[0].y };
            if (landmarks[11] && landmarks[12]) {
              shoulderCenter = {
                x: (landmarks[11].x + landmarks[12].x) / 2,
                y: (landmarks[11].y + landmarks[12].y) / 2,
              };
            }
          }

          // Update game engine logic
          if (engine.state === 'playing' || engine.state === 'tutorial') {
            engine.update(time, leftWrist, rightWrist, nose, shoulderCenter, displayWidth, displayHeight);
          }

          // Render canvas in Avatar Silhouette mode
          canvasRenderer.render(
            ctx,
            displayWidth,
            displayHeight,
            engine,
            landmarks,
            'silhouette',
            engine.state === 'calibrating' || engine.state === 'countdown'
          );

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isConnected]);

  // Initialize TV Host Receiver Session
  const initReceiver = useCallback((codeToUse: string) => {
    if (sessionRef.current) {
      sessionRef.current.destroy();
    }

    const session = new TvReceiverSession(codeToUse);
    sessionRef.current = session;

    session.onClientConnected = () => {
      console.log('[TvView] Phone connected in Pose Sensor Mode');
      setIsConnected(true);
      setErrorMsg(null);
      // Auto-focus sound enable button for TV remote
      setTimeout(() => {
        soundButtonRef.current?.focus();
      }, 300);
    };

    session.onControlCommandReceived = (cmd) => {
      handleControlCommand(cmd);
    };

    session.onClientDisconnected = () => {
      console.log('[TvView] Phone disconnected, returning to pairing screen');
      setIsConnected(false);
      engineRef.current.state = 'idle';
      setGameState('idle');
      remotePoseProvider.reset();
    };

    session.onError = (err) => {
      console.warn('[TvView] Receiver error:', err);
      setErrorMsg(err.message || 'Receiver connection error.');
    };

    session.start((registeredCode) => {
      setRoomCode(registeredCode);
    });
  }, [handleControlCommand]);

  useEffect(() => {
    initReceiver(roomCode);

    return () => {
      sessionRef.current?.destroy();
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleRegenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    initReceiver(newCode);
  };

  const handleCalibrationComplete = useCallback((confirmedPosture: PostureType = 'uncalibrated') => {
    const engine = engineRef.current;
    const finalCalibration = postureDetector.finalizeCalibration(
      confirmedPosture === 'uncalibrated' ? undefined : confirmedPosture
    );
    engine.calibration = finalCalibration;
    setDetectedPosture(finalCalibration.posture);

    if (isTutorial) {
      engine.startTutorial(finalCalibration);
    } else {
      engine.startSession(gameMode, finalCalibration, difficulty);
    }
    setGameState(engine.state);
  }, [isTutorial, gameMode, difficulty]);

  const handleManualPostureOverride = useCallback((posture: PostureType) => {
    setDetectedPosture(posture);
    engineRef.current.calibration.posture = posture;
  }, []);

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || secs < 0) return '0:00';
    const totalSecs = Math.max(0, Math.floor(secs));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 1. CONNECTED / ACTIVE TV GAMEPLAY VIEW (Runs local engine at 60 FPS in Silhouette Mode)
  if (isConnected) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#0a0e17] select-none flex items-center justify-center">
        {/* Fullscreen 60 FPS Game Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Remote TV Audio Unmute Prompt (D-pad focusable) */}
        {!soundEnabled && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <button
              ref={soundButtonRef}
              onClick={handleEnableSound}
              autoFocus
              tabIndex={0}
              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-pulse-cyan text-black font-arcade font-black text-base shadow-glow-cyan border-2 border-white hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-pulse-cyan cursor-pointer"
            >
              <Volume2 className="w-6 h-6 animate-pulse" />
              <span>PRESS [OK] ON REMOTE TO ENABLE SOUND</span>
            </button>
          </div>
        )}

        {/* Menu Phase Subtle Banner */}
        {gameState === 'idle' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full bg-slate-900/95 border-2 border-pulse-cyan shadow-glow-cyan backdrop-blur-md flex items-center gap-3 text-white">
            <Smartphone className="w-5 h-5 text-pulse-cyan animate-pulse" />
            <span className="font-arcade text-sm tracking-wide">
              CONNECTED TO PHONE — SELECT WORKOUT ON YOUR PHONE
            </span>
          </div>
        )}

        {/* Calibration Overlay */}
        {(gameState === 'calibrating' || gameState === 'countdown') && (
          <CalibrationOverlay
            detectedPosture={detectedPosture}
            calibration={engineRef.current.calibration}
            onComplete={handleCalibrationComplete}
            onManualOverride={handleManualPostureOverride}
          />
        )}

        {/* In-Game Crisp High-Contrast TV HUD Overlay */}
        {(gameState === 'playing' || gameState === 'paused') && (
          <div className="absolute inset-0 z-30 pointer-events-none p-6 md:p-8 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex items-start justify-between w-full">
              {/* Score & Multiplier */}
              <div className="flex flex-col">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest">SCORE</span>
                <span className="text-4xl md:text-5xl font-black font-arcade text-white drop-shadow-lg tracking-wider">
                  {stats.score.toLocaleString()}
                </span>
                {stats.combo > 1 && (
                  <div className="inline-flex items-center gap-1.5 mt-1">
                    <span className={`px-2.5 py-0.5 rounded-md font-black font-arcade text-xs ${
                      stats.combo >= 4
                        ? 'bg-pulse-gold/20 border border-pulse-gold text-pulse-gold shadow-glow-gold'
                        : stats.combo >= 3
                        ? 'bg-pulse-magenta/20 border border-pulse-magenta text-pulse-magenta shadow-glow-magenta'
                        : 'bg-pulse-cyan/20 border border-pulse-cyan/40 text-pulse-cyan'
                    }`}>
                      {stats.combo}x COMBO
                    </span>
                  </div>
                )}
              </div>

              {/* Center: Time Remaining */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest">TIME</span>
                <span className="text-4xl md:text-5xl font-black font-arcade text-pulse-cyan drop-shadow-lg font-mono">
                  {gameMode === 'endless' ? '∞' : formatTime(timeRemaining)}
                </span>
              </div>

              {/* Right: Calories & Difficulty */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> CALORIES
                </span>
                <span className="text-3xl md:text-4xl font-black font-arcade text-amber-400 drop-shadow-lg">
                  {Math.round(stats.caloriesBurned)} <span className="text-xs text-gray-400 font-normal">kcal</span>
                </span>
                <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-arcade font-bold uppercase bg-white/10 text-gray-300 border border-white/20">
                  {difficulty}
                </span>
              </div>
            </div>

            {/* TV Workout Paused Banner in Center */}
            {gameState === 'paused' && (
              <div className="self-center p-6 px-10 rounded-2xl bg-black/85 border-2 border-pulse-gold shadow-glow-gold text-center animate-pulse pointer-events-auto">
                <h3 className="text-4xl font-black font-arcade text-pulse-gold tracking-widest">
                  WORKOUT PAUSED
                </h3>
                <p className="text-xs text-gray-300 mt-2 font-arcade">
                  Resume or adjust settings on your smartphone
                </p>
              </div>
            )}

            {/* Bottom Status Ticker */}
            <div className="flex items-center justify-between text-xs text-gray-400 font-arcade">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-bold uppercase tracking-wider">
                  TV Avatar Silhouette Mode
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="uppercase">Posture: <strong className="text-pulse-cyan">{detectedPosture}</strong></span>
                <span>•</span>
                <span>TV FPS: <strong className="text-white">{remotePoseProvider.fps}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial Overlay on TV */}
        {gameState === 'tutorial' && (
          <TutorialOverlay
            step={tutorialStep}
            count={tutorialCount}
            onSkip={() => {
              engineRef.current.state = 'idle';
              setIsTutorial(false);
              setGameState('idle');
            }}
            onFinishAndStart={() => {
              setIsTutorial(false);
              engineRef.current.startSession(gameMode, engineRef.current.calibration, difficulty);
            }}
          />
        )}

        {/* Workout Summary on TV */}
        {gameState === 'game_over' && (
          <SummaryModal
            stats={stats}
            mode={gameMode}
            difficulty={difficulty}
            onPlayAgain={() => {
              engineRef.current.startSession(gameMode, engineRef.current.calibration, difficulty);
            }}
            onReturnToMenu={() => {
              engineRef.current.state = 'idle';
              setIsTutorial(false);
              setGameState('idle');
            }}
          />
        )}
      </div>
    );
  }

  // 2. PAIRING / WAITING SCREEN (No phone connected yet)
  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-y-auto bg-[#070b12] text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 select-none">
      {/* Decorative Cyber Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pulse-cyan/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-pulse-magenta/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top TV Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pulse-cyan/15 border border-pulse-cyan/40 text-pulse-cyan shadow-sm">
            <Tv className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-pulse-cyan/10 border border-pulse-cyan/30 text-pulse-cyan text-[10px] font-bold font-arcade tracking-wider uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-cyan animate-pulse" />
              TV RECEIVER MODE (POSE SENSOR)
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-arcade tracking-wider bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta bg-clip-text text-transparent">
              KINETIC BLITZ
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerateCode}
            title="Generate new room code"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-gray-300 hover:text-white text-xs font-arcade transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Code</span>
          </button>

          <button
            onClick={handleToggleFullscreen}
            title="Toggle TV Fullscreen"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-gray-300 hover:text-white text-xs font-arcade transition-all cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Large QR Code & Room Code */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-10 md:gap-16 my-auto max-w-5xl mx-auto w-full">
        {/* Left: High-Contrast QR Code Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-700 hover:border-pulse-cyan/50 shadow-2xl flex flex-col items-center text-center transition-all">
          <div className="p-4 bg-white rounded-2xl shadow-inner mb-4">
            <QRCode
              value={qrUrl}
              size={210}
              level="H"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          </div>
          <span className="text-xs font-arcade text-pulse-cyan tracking-wider uppercase flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Scan with Phone Camera
          </span>
          <span className="text-[11px] text-gray-400 mt-1 font-mono break-all max-w-xs">
            {qrUrl}
          </span>
        </div>

        {/* Right: Big Room Code & Simple 3-Step Instructions */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-lg">
          <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest mb-1">
            TV ROOM CODE
          </span>
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/60 border-2 border-pulse-cyan shadow-glow-cyan mb-6">
            <span className="text-5xl md:text-6xl font-black font-arcade text-white tracking-[0.25em] font-mono">
              {roomCode}
            </span>
          </div>

          <div className="space-y-4 w-full">
            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Scan QR or Open Site</h3>
                <p className="text-xs text-gray-400">Scan QR code above with your phone camera to pair instantly.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Tap "Play on TV"</h3>
                <p className="text-xs text-gray-400">On your phone, tap "Play on TV" and enter code <strong className="text-pulse-cyan font-mono">{roomCode}</strong>.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Prop Phone Under TV</h3>
                <p className="text-xs text-gray-400">Your phone becomes the camera sensor; game runs natively at 60 FPS on your TV!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Footer */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 pt-5 text-xs text-gray-400 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
          <span className="font-arcade tracking-wider">
            WAITING FOR PHONE SENSOR CONNECTION...
          </span>
        </div>

        {errorMsg && (
          <div className="text-rose-400 text-xs font-arcade">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Low-latency Pose JSON over PeerJS. Zero server storage.</span>
        </div>
      </div>
    </div>
  );
};
