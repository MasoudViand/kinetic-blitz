import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode, GameState, CameraMode, PostureType, DifficultyLevel, TutorialStep, PlayerStats, Landmark3D, Point2D } from './types/game';
import { GameEngine } from './engine/gameEngine';
import { canvasRenderer } from './renderer/canvasRenderer';
import { poseService } from './vision/poseService';
import { postureDetector } from './vision/postureDetector';
import { mockPoseProvider } from './vision/mockPoseProvider';
import { soundEngine } from './audio/soundEngine';
import { getFistPosition } from './vision/handTracking';

import { StartScreen } from './components/StartScreen';
import { CalibrationOverlay } from './components/CalibrationOverlay';
import { GameHUD } from './components/GameHUD';
import { SummaryModal } from './components/SummaryModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { DevToolbar } from './components/DevToolbar';

import { TvReceiverView } from './tv/TvReceiverView';
import { PlayOnTvModal } from './tv/PlayOnTvModal';
import { PhoneRemoteView } from './tv/PhoneRemoteView';
import { phoneCastSession, sanitizeRoomCode, TvStateUpdate } from './tv/tvCastService';
import { Smartphone, X } from 'lucide-react';

export const App: React.FC = () => {
  // Routing: Route to <TvReceiverView /> when on /tv or #/tv (no router library needed)
  const [isTvView, setIsTvView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/tv') || window.location.hash.startsWith('#/tv');
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setIsTvView(window.location.pathname.startsWith('/tv') || window.location.hash.startsWith('#/tv'));
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());

  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameMode>('quick');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    const saved = localStorage.getItem('kinetic_blitz_camera_mode') || localStorage.getItem('kinetic_pulse_camera_mode');
    return (saved === 'dimmed' || saved === 'silhouette' || saved === 'hidden') ? saved : 'dimmed';
  });
  const [isMuted, setIsMuted] = useState<boolean>(soundEngine.getMuted());
  const [detectedPosture, setDetectedPosture] = useState<PostureType>('uncalibrated');
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [isMockActive, setIsMockActive] = useState<boolean>(mockPoseProvider.enabled);
  const [stats, setStats] = useState<PlayerStats>(engineRef.current.stats);

  const [isTutorial, setIsTutorial] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('intro');
  const [tutorialCount, setTutorialCount] = useState<number>(0);

  // TV Casting states
  const [isTvModalOpen, setIsTvModalOpen] = useState<boolean>(false);
  const [tvModalInitialCode, setTvModalInitialCode] = useState<string>('');
  const [isTvConnected, setIsTvConnected] = useState<boolean>(phoneCastSession.status === 'connected');
  const [tvConnectedCode, setTvConnectedCode] = useState<string | null>(phoneCastSession.connectedCode);
  const [showTvPlacementBanner, setShowTvPlacementBanner] = useState<boolean>(false);
  const [tvState, setTvState] = useState<TvStateUpdate | null>(null);

  const landmarksRef = useRef<Landmark3D[] | null>(null);

  // Sync state callbacks from GameEngine
  useEffect(() => {
    if (isTvView) return;

    const engine = engineRef.current;
    (window as unknown as { __KINETIC_BLITZ_ENGINE__: GameEngine }).__KINETIC_BLITZ_ENGINE__ = engine;
    mockPoseProvider.setGameEngine(engine);
    engine.onStateChange = (newState) => setGameState(newState);
    engine.onStatsUpdate = (newStats) => {
      setStats({ ...newStats });
      setTimeRemaining(engine.timeRemaining);
    };
    engine.onTutorialStepChange = (step, count) => {
      setTutorialStep(step);
      setTutorialCount(count);
    };
  }, [isTvView]);

  // Connect / Disconnect TV handlers
  const handleConnectTv = useCallback(async (code: string) => {
    const success = await phoneCastSession.connectToTv(code);
    if (success) {
      setShowTvPlacementBanner(true);
      setTimeout(() => {
        setShowTvPlacementBanner(false);
      }, 5000);
    }
    return success;
  }, []);

  const handleDisconnectTv = useCallback(() => {
    phoneCastSession.disconnect();
  }, []);

  // Sync TV connection status & telemetry
  useEffect(() => {
    phoneCastSession.onStatusChange = (status, code) => {
      setIsTvConnected(status === 'connected');
      setTvConnectedCode(code || null);
      if (status !== 'connected') {
        setTvState(null);
      }
    };
    phoneCastSession.onStateUpdate = (update) => {
      setTvState(update);
      if (update.postureMode) {
        setDetectedPosture(update.postureMode);
      }
    };
    return () => {
      phoneCastSession.onStatusChange = undefined;
      phoneCastSession.onStateUpdate = undefined;
    };
  }, []);

  // Check URL parameters for ?tv=CODE and ?mock=true on load
  useEffect(() => {
    if (isTvView) return;

    const params = new URLSearchParams(window.location.search);
    const mockParam = params.get('mock');
    if (mockParam === 'true') {
      mockPoseProvider.enabled = true;
      setIsMockActive(true);
    }

    const tvParam = params.get('tv');
    if (tvParam) {
      const cleanCode = sanitizeRoomCode(tvParam);
      if (cleanCode.length === 4) {
        setTvModalInitialCode(cleanCode);
        setIsTvModalOpen(true);
        const timer = setTimeout(() => {
          handleConnectTv(cleanCode).catch((err) => {
            console.warn('[App] Auto TV connect failed:', err);
          });
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isTvView, handleConnectTv]);

  // Initialize camera & pose service (Only on phone/desktop, never on TV)
  useEffect(() => {
    if (isTvView) return;

    if (videoRef.current) {
      poseService.initialize(videoRef.current).then(() => {
        setIsMockActive(mockPoseProvider.enabled);
      });
    }

    const unsubscribe = poseService.subscribe((landmarks) => {
      landmarksRef.current = landmarks;

      // When casting to TV in Low-Latency Pose Sensor Mode: stream landmarks to TV and skip local game logic
      if (phoneCastSession.status === 'connected') {
        phoneCastSession.sendPosePacket(landmarks);
        if (landmarks) {
          const posture = postureDetector.classifyPosture(landmarks);
          setDetectedPosture(posture);
        }
        return;
      }

      const engine = engineRef.current;
      const now = performance.now();

      // Check Presence & Handle Auto-Pause
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
      poseService.stop();
    };
  }, [isTvView]);

  // Main 60 FPS Render & Engine Loop
  useEffect(() => {
    if (isTvView) return;

    let animId: number;

    const renderLoop = (time: number) => {
      if (phoneCastSession.status === 'connected') {
        // Skip canvas rendering on phone when casting to TV to save CPU/battery
        animId = requestAnimationFrame(renderLoop);
        return;
      }
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      const landmarks = landmarksRef.current;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Keep canvas dimensions synced with display
          if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
          }

          let leftWrist: Point2D | null = null;
          let rightWrist: Point2D | null = null;
          let nose: Point2D | null = null;
          let shoulderCenter: Point2D | null = null;

          if (landmarks && landmarks.length > 16) {
            leftWrist = getFistPosition(landmarks, 'left');
            rightWrist = getFistPosition(landmarks, 'right');
            if ((landmarks[0].visibility ?? 1) > 0.4) nose = { x: landmarks[0].x, y: landmarks[0].y };
            if ((landmarks[11].visibility ?? 1) > 0.4 && (landmarks[12].visibility ?? 1) > 0.4) {
              shoulderCenter = {
                x: (landmarks[11].x + landmarks[12].x) / 2,
                y: (landmarks[11].y + landmarks[12].y) / 2,
              };
            }
          }

          // Update Engine
          if (engine.state === 'playing' || engine.state === 'tutorial') {
            engine.update(time, leftWrist, rightWrist, nose, shoulderCenter, canvas.width, canvas.height);
          }

          // Render Graphics Layer
          canvasRenderer.render(
            ctx,
            canvas.width,
            canvas.height,
            engine,
            landmarks,
            cameraMode,
            engine.state === 'calibrating' || engine.state === 'countdown'
          );
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [isTvView, cameraMode]);

  // Workout Flow Controls
  const handleStartWorkout = (mode: GameMode, posturePref: PostureType, selectedDifficulty: DifficultyLevel) => {
    setGameMode(mode);
    setDifficulty(selectedDifficulty);
    setIsTutorial(false);
    setDetectedPosture(posturePref);
    postureDetector.resetCalibration();

    const engine = engineRef.current;
    engine.difficulty = selectedDifficulty;
    engine.state = 'calibrating';
    setGameState('calibrating');
  };

  const handleStartTutorial = () => {
    setIsTutorial(true);
    setDetectedPosture('uncalibrated');
    postureDetector.resetCalibration();

    const engine = engineRef.current;
    engine.state = 'calibrating';
    setGameState('calibrating');
  };

  const handleCalibrationComplete = (confirmedPosture: PostureType = 'uncalibrated') => {
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
  };

  const handleManualPostureOverride = (overridePosture: PostureType) => {
    setDetectedPosture(overridePosture);
    if (mockPoseProvider.enabled) {
      mockPoseProvider.simulatedPosture = overridePosture;
    }
  };

  const handleToggleMute = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleSelectCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    localStorage.setItem('kinetic_blitz_camera_mode', mode);
  };

  const handleToggleCameraMode = () => {
    setCameraMode((prev) => {
      const next: CameraMode = prev === 'dimmed' ? 'silhouette' : prev === 'silhouette' ? 'hidden' : 'dimmed';
      localStorage.setItem('kinetic_blitz_camera_mode', next);
      return next;
    });
  };

  const handlePauseToggle = () => {
    const engine = engineRef.current;
    if (engine.state === 'playing' || engine.state === 'tutorial') {
      engine.pauseSession();
    } else if (engine.state === 'paused') {
      engine.resumeSession();
    }
  };

  const handleRestart = () => {
    const engine = engineRef.current;
    if (isTutorial) {
      engine.startTutorial(engine.calibration);
    } else {
      engine.startSession(gameMode, engine.calibration, difficulty);
    }
  };

  const handleExitToMenu = () => {
    const engine = engineRef.current;
    engine.state = 'idle';
    setIsTutorial(false);
    setGameState('idle');
  };

  const handleEnableMock = () => {
    mockPoseProvider.enabled = !mockPoseProvider.enabled;
    setIsMockActive(mockPoseProvider.enabled);
  };

  // TV VIEW ROUTE
  if (isTvView) {
    return <TvReceiverView />;
  }

  // PHONE REMOTE VIEW (When paired to TV as low-latency pose sensor & remote)
  if (isTvConnected && tvConnectedCode) {
    return (
      <div className="relative w-full h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#070b12] select-none">
        {/* Underlying video element keeping camera feed running continuously for MediaPipe */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="fixed opacity-0 pointer-events-none -z-50 w-1 h-1"
        />

        <PhoneRemoteView
          roomCode={tvConnectedCode}
          onDisconnect={handleDisconnectTv}
          detectedPosture={detectedPosture}
          onTogglePosture={() => {
            const next = detectedPosture === 'standing' ? 'seated' : 'standing';
            setDetectedPosture(next);
            phoneCastSession.sendControlCommand({ type: 'SET_POSTURE', posture: next });
          }}
          tvState={tvState}
          onSendCommand={(cmd) => phoneCastSession.sendControlCommand(cmd)}
        />

        {/* Dev Tools Drawer in DEV mode for autonomous bot / testing */}
        {import.meta.env.DEV && (
          <DevToolbar onPostureChanged={(p) => {
            setDetectedPosture(p);
            phoneCastSession.sendControlCommand({ type: 'SET_POSTURE', posture: p });
          }} />
        )}
      </div>
    );
  }

  // PLAYER / PHONE STANDALONE VIEW ROUTE
  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#0a0e17] flex items-center justify-center select-none">
      {/* 1. Underlying Mirrored Webcam Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 scale-x-[-1] ${
          cameraMode === 'dimmed'
            ? 'opacity-35 brightness-90 contrast-110'
            : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. Interactive Game 2D Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 block pointer-events-none"
      />

      {/* 3. Screens & Overlays */}
      {gameState === 'idle' && (
        <StartScreen
          onStart={handleStartWorkout}
          onStartTutorial={handleStartTutorial}
          onEnableMock={handleEnableMock}
          isMockActive={isMockActive}
          cameraMode={cameraMode}
          onSelectCameraMode={handleSelectCameraMode}
          isTvConnected={isTvConnected}
          tvConnectedCode={tvConnectedCode}
          onOpenTvModal={() => setIsTvModalOpen(true)}
          onDisconnectTv={handleDisconnectTv}
        />
      )}

      {(gameState === 'calibrating' || gameState === 'countdown') && (
        <CalibrationOverlay
          detectedPosture={detectedPosture}
          calibration={engineRef.current.calibration}
          onComplete={handleCalibrationComplete}
          onManualOverride={handleManualPostureOverride}
        />
      )}

      {gameState === 'tutorial' && (
        <TutorialOverlay
          step={tutorialStep}
          count={tutorialCount}
          onSkip={handleExitToMenu}
          onFinishAndStart={() => {
            setIsTutorial(false);
            engineRef.current.startSession('quick', engineRef.current.calibration, difficulty);
          }}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUD
          stats={stats}
          timeRemaining={timeRemaining}
          isEndless={gameMode === 'endless'}
          gameState={gameState}
          posture={engineRef.current.calibration.posture}
          cameraMode={cameraMode}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onToggleCameraMode={handleToggleCameraMode}
          onPauseToggle={handlePauseToggle}
          onRestart={handleRestart}
          onExit={handleExitToMenu}
        />
      )}

      {gameState === 'game_over' && (
        <SummaryModal
          stats={stats}
          mode={gameMode}
          difficulty={difficulty}
          onPlayAgain={handleRestart}
          onReturnToMenu={handleExitToMenu}
        />
      )}

      {/* TV Placement Tip Banner */}
      {showTvPlacementBanner && (
        <div className="absolute top-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 max-w-sm sm:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3 px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-slate-900/95 border-2 border-pulse-cyan text-white shadow-glow-cyan backdrop-blur-md">
            <Smartphone className="w-5 h-5 text-pulse-cyan animate-pulse shrink-0" />
            <div className="text-xs">
              <strong className="text-pulse-cyan block font-arcade text-[11px] sm:text-xs">TV CAST CONNECTED!</strong>
              <span className="text-[11px] sm:text-xs text-gray-200">Prop your phone horizontally below the TV facing your play area.</span>
            </div>
            <button
              onClick={() => setShowTvPlacementBanner(false)}
              className="ml-auto text-gray-400 hover:text-white p-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Play on TV Modal */}
      <PlayOnTvModal
        isOpen={isTvModalOpen}
        onClose={() => setIsTvModalOpen(false)}
        onConnect={handleConnectTv}
        onDisconnect={handleDisconnectTv}
        isConnected={isTvConnected}
        connectedCode={tvConnectedCode}
        initialCode={tvModalInitialCode}
      />

      {/* 4. Developer & Mock Pose Toolbar (Only visible in dev mode) */}
      {import.meta.env.DEV && (
        <DevToolbar onPostureChanged={handleManualPostureOverride} />
      )}
    </div>
  );
};
