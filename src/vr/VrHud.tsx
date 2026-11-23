import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { vrEngine } from './vrEngine';
import { vrUiRegistry } from './vrUi';
import { VrButton } from './VrButton';

interface VrHudProps {
  onExitSession?: () => void;
}

export const VrHud: React.FC<VrHudProps> = ({ onExitSession }) => {
  const groupRef = useRef<THREE.Group>(null);
  const planeMeshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawnTime = useRef<number>(0);
  const { camera } = useThree();

  const [engineState, setEngineState] = useState(vrEngine.state);

  // Sync onExitSession with engine
  useEffect(() => {
    if (onExitSession) {
      vrEngine.onExitSession = onExitSession;
    }
    return () => {
      vrEngine.onExitSession = undefined;
    };
  }, [onExitSession]);

  // Register HUD plane for laser raycaster aiming detection
  useEffect(() => {
    if (planeMeshRef.current) {
      vrUiRegistry.setHudPlane(planeMeshRef.current);
    }
    return () => {
      vrUiRegistry.setHudPlane(null);
    };
  }, []);

  // Create HUD offscreen canvas and texture once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    canvasRef.current = canvas;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    textureRef.current = texture;

    return () => {
      texture.dispose();
    };
  }, []);

  const drawHUD = useCallback(() => {
    const canvas = canvasRef.current;
    const texture = textureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const state = vrEngine.state;

    // Background panel with neon border
    ctx.fillStyle = state === 'paused' ? 'rgba(8, 12, 22, 0.92)' : 'rgba(7, 13, 26, 0.85)';
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, height - 32, 28);
    ctx.fill();

    // Border glow
    ctx.strokeStyle =
      state === 'paused'
        ? '#f59e0b'
        : vrEngine.stats.isOverdrive
        ? '#ff0077'
        : '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // ==========================================
    // 1. COUNTDOWN STATE
    // ==========================================
    if (state === 'countdown') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('STRIKE CALIBRATION ACTIVE', width / 2, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 130px monospace';
      const count = Math.max(1, Math.ceil(vrEngine.timeRemaining > 0 ? 3 - (vrEngine.elapsedTime % 3) : 3));
      ctx.fillText(`${count}`, width / 2, 260);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('RAISE FISTS • PUNCH APPROACHING ORBS', width / 2, 380);

      ctx.fillStyle = '#00f0ff';
      ctx.font = '18px monospace';
      ctx.fillText('Aim laser & pull Trigger to click menus   •   Thumbstick: Recenter', width / 2, 430);

      texture.needsUpdate = true;
      return;
    }

    // ==========================================
    // 2. PAUSED STATE
    // ==========================================
    if (state === 'paused') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('KINETIC BLITZ VR', width / 2, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 60px monospace';
      ctx.fillText('GAME PAUSED', width / 2, 85);

      // Current workout stats overview
      const seconds = Math.max(0, Math.ceil(vrEngine.timeRemaining));
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = vrEngine.mode === 'endless' ? '∞' : `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `SCORE: ${vrEngine.stats.score}   •   COMBO: x${vrEngine.stats.combo}   •   TIME: ${timeStr}`,
        width / 2,
        170
      );

      // Clean footer guidance (Buttons are 3D meshes rendered in front)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText('Point controller & pull Trigger to select   •   Thumbstick: Recenter', width / 2, 380);

      texture.needsUpdate = true;
      return;
    }

    // ==========================================
    // 3. GAME OVER / WORKOUT SUMMARY STATE
    // ==========================================
    if (state === 'game_over' || state === 'summary') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('KINETIC BLITZ VR', width / 2, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px monospace';
      ctx.fillText('WORKOUT COMPLETE!', width / 2, 75);

      const rank =
        vrEngine.stats.score >= 10000
          ? 'S'
          : vrEngine.stats.score >= 6000
          ? 'A'
          : vrEngine.stats.score >= 3000
          ? 'B'
          : 'C';

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 38px monospace';
      ctx.fillText(`SCORE: ${vrEngine.stats.score} (RANK ${rank})`, width / 2, 140);

      // Stats grid
      ctx.font = '22px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'left';

      const leftX = 140;
      const rightX = 540;
      let rowY = 205;

      ctx.fillText(`PUNCHES: ${vrEngine.stats.pulseHits}`, leftX, rowY);
      ctx.fillText(`POWER HITS: ${vrEngine.stats.powerHits}`, rightX, rowY);

      rowY += 38;
      ctx.fillText(`VOLT HOLDS: ${vrEngine.stats.solarHolds}`, leftX, rowY);
      ctx.fillText(`LASERS DODGED: ${vrEngine.stats.lasersDodged}`, rightX, rowY);

      rowY += 38;
      ctx.fillText(`MAX COMBO: x${vrEngine.stats.maxCombo}`, leftX, rowY);
      ctx.fillText(`CALORIES: ~${vrEngine.stats.caloriesBurned} kcal`, rightX, rowY);

      // Clean footer subtext (Buttons are 3D meshes rendered in front)
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '16px monospace';
      ctx.fillText('Point controller & pull Trigger to select   •   Thumbstick: Recenter', width / 2, 445);

      texture.needsUpdate = true;
      return;
    }

    // ==========================================
    // 4. ACTIVE PLAYING HUD
    // ==========================================
    // Header Bar
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('KINETIC BLITZ VR', 48, 40);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      `${vrEngine.mode.toUpperCase()} • ${vrEngine.difficulty.toUpperCase()}`,
      width - 48,
      44
    );

    // Score & Combo
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText('SCORE', 48, 86);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px monospace';
    ctx.fillText(`${vrEngine.stats.score}`, 48, 110);

    // Combo streak
    if (vrEngine.stats.combo > 1) {
      ctx.fillStyle = vrEngine.stats.combo >= 8 ? '#ff0077' : '#ffd700';
      ctx.font = '900 36px monospace';
      ctx.fillText(`x${vrEngine.stats.combo} COMBO`, 340, 122);
    }

    // Time Remaining (Right side)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText('TIME REMAINING', width - 48, 86);

    const seconds = Math.max(0, Math.ceil(vrEngine.timeRemaining));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr =
      vrEngine.mode === 'endless'
        ? '∞'
        : `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    ctx.fillStyle = seconds <= 10 && vrEngine.mode !== 'endless' ? '#ff0055' : '#00f0ff';
    ctx.font = '900 52px monospace';
    ctx.fillText(timeStr, width - 48, 110);

    // Overdrive Gauge Bar
    const barX = 48;
    const barY = 200;
    const barW = width - 96;
    const barH = 28;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('BLITZ OVERDRIVE', barX, barY - 26);

    // Track
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    // Fill
    const fillW = (Math.max(0, Math.min(100, vrEngine.stats.overdrive)) / 100) * barW;
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#ff0077');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 8);
      ctx.fill();
    }

    // Overdrive ready banner
    if (vrEngine.stats.isOverdrive) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 16px monospace';
      ctx.fillText('🔥 OVERDRIVE ACTIVE (2X POINTS) 🔥', width / 2, barY + 20);
    }

    // Secondary Telemetry Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px monospace';
    ctx.fillText(
      `PUNCHES: ${vrEngine.stats.pulseHits} (${vrEngine.stats.powerHits} POWER)   HOLDS: ${vrEngine.stats.solarHolds}   DODGES: ${vrEngine.stats.lasersDodged}`,
      48,
      270
    );

    ctx.fillText(
      `CALORIES: ~${vrEngine.stats.caloriesBurned} kcal`,
      48,
      305
    );

    // Action Prompts & Controls Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      'Aim at Pause button or press B / Y   •   Thumbstick: Recenter',
      width / 2,
      445
    );

    texture.needsUpdate = true;
  }, []);

  // Subscribe to engine HUD dirty and state change events
  useEffect(() => {
    vrEngine.onHudDirty = () => {
      setEngineState(vrEngine.state);
      drawHUD();
    };
    drawHUD();
    return () => {
      vrEngine.onHudDirty = undefined;
    };
  }, [drawHUD]);

  // Periodic redraw for clock & calories + positioning
  useFrame(() => {
    const now = performance.now();
    if (now - lastDrawnTime.current > 250) {
      lastDrawnTime.current = now;
      drawHUD();
    }

    // Position HUD ahead of player in calibrated corridor
    if (groupRef.current) {
      const isPaused = vrEngine.state === 'paused';
      const isSummary = vrEngine.state === 'game_over' || vrEngine.state === 'summary';

      const localY = vrEngine.calibration.headY + (isPaused ? 0.12 : isSummary ? 0.20 : 0.35);
      const localZ = isPaused ? -1.5 : isSummary ? -1.6 : -1.8;

      const localHud = new THREE.Vector3(0, localY, localZ);
      vrEngine.localToWorld(localHud, groupRef.current.position);

      groupRef.current.rotation.y = vrEngine.calibration.forwardYaw;
      groupRef.current.rotation.x = isPaused ? 0.06 : isSummary ? 0.08 : 0.12;
    }
  });

  const isPaused = engineState === 'paused';
  const isSummary = engineState === 'game_over' || engineState === 'summary';
  const isPlaying = engineState === 'playing';

  return (
    <group ref={groupRef} position={[0, 1.8, -1.8]}>
      {/* Background HUD Canvas Display */}
      <mesh ref={planeMeshRef}>
        <planeGeometry args={[1.6, 0.8]} />
        {textureRef.current && (
          <meshBasicMaterial
            map={textureRef.current}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        )}
      </mesh>

      {/* 1. PLAYING: Clickable 3D PAUSE Button */}
      {isPlaying && (
        <VrButton
          id="hud-pause"
          label="PAUSE"
          width={0.24}
          height={0.075}
          position={[0.56, 0.28, 0.02]}
          color="#f59e0b"
          hoverColor="#fbbf24"
          onClick={() => vrEngine.pauseGame()}
        />
      )}

      {/* 2. PAUSED: Clickable 3D RESUME, RESTART, STOP & EXIT Buttons */}
      {isPaused && (
        <>
          <VrButton
            id="pause-resume"
            label="RESUME"
            width={0.36}
            height={0.11}
            position={[-0.44, -0.12, 0.02]}
            color="#00f0ff"
            hoverColor="#38bdf8"
            onClick={() => vrEngine.resumeGame()}
          />
          <VrButton
            id="pause-restart"
            label="RESTART"
            width={0.36}
            height={0.11}
            position={[0, -0.12, 0.02]}
            color="#f59e0b"
            hoverColor="#fbbf24"
            onClick={() => vrEngine.restartGame(camera)}
          />
          <VrButton
            id="pause-exit"
            label="STOP & EXIT"
            width={0.36}
            height={0.11}
            position={[0.44, -0.12, 0.02]}
            color="#ef4444"
            hoverColor="#f87171"
            onClick={() => {
              vrEngine.state = 'idle';
              vrEngine.onExitSession?.();
            }}
          />
        </>
      )}

      {/* 3. SUMMARY: Clickable 3D PLAY AGAIN and BACK TO MENU Buttons */}
      {isSummary && (
        <>
          <VrButton
            id="summary-play-again"
            label="PLAY AGAIN"
            width={0.44}
            height={0.11}
            position={[-0.26, -0.22, 0.02]}
            color="#00f0ff"
            hoverColor="#38bdf8"
            onClick={() => vrEngine.restartGame(camera)}
          />
          <VrButton
            id="summary-menu"
            label="BACK TO MENU"
            width={0.44}
            height={0.11}
            position={[0.26, -0.22, 0.02]}
            color="#ef4444"
            hoverColor="#f87171"
            onClick={() => {
              vrEngine.state = 'idle';
              vrEngine.onExitSession?.();
            }}
          />
        </>
      )}
    </group>
  );
};
