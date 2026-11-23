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

// Configure WebXR store with custom fist knuckles and dev emulator
export const xrStore = createXRStore({
  controller: {
    left: VrFistLeft,
    right: VrFistRight,
  },
  hand: {
    left: VrHandFistLeft,
    right: VrHandFistRight,
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
  const { camera } = useThree();
  const session = useXR((xr) => xr.session);
  const calibratedOnce = useRef(false);

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

  useFrame((_, delta) => {
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
