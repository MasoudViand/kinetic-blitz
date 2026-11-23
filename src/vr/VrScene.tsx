import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, createXRStore, useXR } from '@react-three/xr';
import { vrEngine } from './vrEngine';
import { VrFistLeft, VrFistRight } from './VrFist';
import { VrHandFistLeft, VrHandFistRight } from './VrHandFist';
import { VrTargets } from './VrTargets';
import { VrParticles } from './VrParticles';
import { VrTether } from './VrTether';
import { VrGrid } from './VrGrid';
import { VrCorridorAnchor } from './VrCorridorAnchor';
import { VrHud } from './VrHud';
import { GameMode, DifficultyLevel } from '../types/game';

// Configure WebXR store with bounded-floor request for Quest Roomscale support
export const xrStore = createXRStore({
  controller: {
    left: VrFistLeft,
    right: VrFistRight,
  },
  hand: {
    left: VrHandFistLeft,
    right: VrHandFistRight,
  },
  customSessionInit: {
    requiredFeatures: ['local-floor'],
    optionalFeatures: ['bounded-floor', 'hand-tracking', 'layers'],
  },
  emulate: import.meta.env.DEV ? 'metaQuest3' : false,
});

interface VrSceneProps {
  mode: GameMode;
  difficulty: DifficultyLevel;
  onExitSession?: () => void;
}

// Inner game loop updated synchronously in R3F useFrame
const VrGameLoop: React.FC<{ mode: GameMode; difficulty: DifficultyLevel; onExitSession?: () => void }> = ({
  mode,
  difficulty,
  onExitSession,
}) => {
  const { camera, gl } = useThree();
  const session = useXR((xr) => xr.session);
  const calibratedOnce = useRef(false);

  // Rising-edge tracking and 350ms cooldown for controller buttons
  const lastActionTime = useRef<number>(0);
  const prevButtonStates = useRef<Map<string, boolean>>(new Map());

  // Auto-calibrate and start session once WebXR session is active
  useEffect(() => {
    if (session) {
      vrEngine.startSession(mode, difficulty, camera);
      calibratedOnce.current = true;
    } else {
      if (calibratedOnce.current) {
        onExitSession?.();
      }
    }
  }, [session, mode, difficulty, camera, onExitSession]);

  // Handle visibility changes (Guardian/system menu pause) and session lifecycle
  useEffect(() => {
    if (!session) return;

    // Auto-pause when Meta Guardian boundary or Quest system overlay interrupts
    const handleVisibilityChange = () => {
      if (session.visibilityState === 'visible-blurred' || session.visibilityState === 'hidden') {
        vrEngine.pauseGame();
      }
    };

    const handleSessionEnd = () => {
      vrEngine.state = 'idle';
      onExitSession?.();
    };

    // Bare-hand tap fallback during SUMMARY when no controllers are connected
    const handleSelectStart = (e: XRInputSourceEvent) => {
      if (vrEngine.phase === 'SUMMARY' && !e.inputSource.gamepad) {
        vrEngine.restartGame(camera);
      }
    };

    session.addEventListener('visibilitychange', handleVisibilityChange);
    session.addEventListener('end', handleSessionEnd);
    session.addEventListener('selectstart', handleSelectStart);

    return () => {
      session.removeEventListener('visibilitychange', handleVisibilityChange);
      session.removeEventListener('end', handleSessionEnd);
      session.removeEventListener('selectstart', handleSelectStart);
    };
  }, [session, camera, onExitSession]);

  useFrame((_, delta) => {
    // 1. Poll Controller Gamepad Buttons with Rising-Edge Detection
    const activeSession = gl.xr.getSession();
    if (activeSession) {
      const now = performance.now();
      const COOLDOWN_MS = 350;

      for (const inputSource of activeSession.inputSources) {
        const gamepad = inputSource.gamepad;
        if (!gamepad) continue;

        const handedness = (inputSource.handedness as 'left' | 'right') || 'right';
        const buttons = gamepad.buttons;

        // Button mappings:
        // buttons[1]: Grip
        // buttons[3]: Thumbstick click
        // buttons[4]: A (right) / X (left)
        // buttons[5]: B (right) / Y (left)
        const checkRisingEdge = (btnIndex: number): boolean => {
          if (!buttons[btnIndex]) return false;
          const isPressed = buttons[btnIndex].pressed;
          const key = `${handedness}-${btnIndex}`;
          const wasPressed = !!prevButtonStates.current.get(key);
          prevButtonStates.current.set(key, isPressed);
          return isPressed && !wasPressed;
        };

        const isGripPressed = checkRisingEdge(1);
        const isThumbstickPressed = checkRisingEdge(3);
        const isAorXPressed = checkRisingEdge(4);
        const isBorYPressed = checkRisingEdge(5);

        if (now - lastActionTime.current >= COOLDOWN_MS) {
          const phase = vrEngine.phase;

          if (phase === 'PLAYING') {
            if (isBorYPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.pauseGame();
              lastActionTime.current = now;
            } else if (isThumbstickPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.recalibrate(camera);
              lastActionTime.current = now;
            }
          } else if (phase === 'PAUSED') {
            if (isAorXPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.resumeGame();
              lastActionTime.current = now;
            } else if (isGripPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.restartGame(camera);
              lastActionTime.current = now;
            } else if (isBorYPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.state = 'idle';
              activeSession.end().catch(() => {});
              onExitSession?.();
              lastActionTime.current = now;
            }
          } else if (phase === 'SUMMARY') {
            if (isAorXPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.restartGame(camera);
              lastActionTime.current = now;
            } else if (isBorYPressed) {
              vrEngine.pulseHaptic(handedness, 0.35, 35);
              vrEngine.state = 'idle';
              activeSession.end().catch(() => {});
              onExitSession?.();
              lastActionTime.current = now;
            }
          }
        }
      }
    }

    // 2. Engine Simulation Step
    vrEngine.update(delta, camera, performance.now());
  });

  return null;
};

export const VrScene: React.FC<VrSceneProps> = ({ mode, difficulty, onExitSession }) => {
  return (
    <div className="absolute inset-0 w-full h-full bg-transparent overflow-hidden select-none">
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ position: [0, 1.65, 0], fov: 75 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <XR store={xrStore}>
          <VrGameLoop mode={mode} difficulty={difficulty} onExitSession={onExitSession} />
          <VrCorridorAnchor />
          <VrGrid />
          <VrTargets />
          <VrTether />
          <VrParticles />
          <VrHud />
        </XR>
      </Canvas>
    </div>
  );
};
