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

export const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine>(new GameEngine());

  const [gameState, setGameState] = useState<GameState>('idle');
  const [gameMode, setGameMode] = useState<GameMode>('quick');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    const saved = localStorage.getItem('kinetic_pulse_camera_mode');
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

  const landmarksRef = useRef<Landmark3D[] | null>(null);

  // Sync state callbacks from GameEngine
  useEffect(() => {
    const engine = engineRef.current;
    (window as unknown as { __KINETIC_PULSE_ENGINE__: GameEngine }).__KINETIC_PULSE_ENGINE__ = engine;
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
  }, []);

  // Initialize camera & pose service
  useEffect(() => {
    if (videoRef.current) {
      poseService.initialize(videoRef.current).then(() => {
        setIsMockActive(mockPoseProvider.enabled);
      });
    }

    const unsubscribe = poseService.subscribe((landmarks) => {
      landmarksRef.current = landmarks;

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
  }, []);

  // Main 60 FPS Render & Engine Loop
  useEffect(() => {
    let animId: number;

    const renderLoop = (time: number) => {
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
  }, [cameraMode]);

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

  const handleCalibrationComplete = useCallback((confirmedPosture: PostureType) => {
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
  }, [gameMode, difficulty, isTutorial]);

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
    localStorage.setItem('kinetic_pulse_camera_mode', mode);
  };

  const handleToggleCameraMode = () => {
    setCameraMode((prev) => {
      const next: CameraMode = prev === 'dimmed' ? 'silhouette' : prev === 'silhouette' ? 'hidden' : 'dimmed';
      localStorage.setItem('kinetic_pulse_camera_mode', next);
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0e17] flex items-center justify-center select-none">
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

      {/* 4. Developer & Mock Pose Toolbar */}
      <DevToolbar onPostureChanged={handleManualPostureOverride} />
    </div>
  );
};
