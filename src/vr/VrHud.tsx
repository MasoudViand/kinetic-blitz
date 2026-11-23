import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { vrEngine } from './vrEngine';

export const VrHud: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawnTime = useRef<number>(0);
  const { camera } = useThree();

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

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Background panel with neon border
    ctx.fillStyle = 'rgba(7, 13, 26, 0.82)';
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, height - 32, 28);
    ctx.fill();

    // Border glow
    ctx.strokeStyle = vrEngine.stats.isOverdrive ? '#ff0077' : '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    const state = vrEngine.state;

    // 1. COUNTDOWN STATE
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
      ctx.fillText('[A / X Button: Recalibrate Center]', width / 2, 430);

      texture.needsUpdate = true;
      return;
    }

    // 2. GAME OVER / WORKOUT SUMMARY STATE
    if (state === 'game_over') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('KINETIC BLITZ VR', width / 2, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px monospace';
      ctx.fillText('WORKOUT COMPLETE!', width / 2, 75);

      // Score and rank
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

      rowY += 40;
      ctx.fillText(`VOLT HOLDS: ${vrEngine.stats.solarHolds}`, leftX, rowY);
      ctx.fillText(`LASERS DODGED: ${vrEngine.stats.lasersDodged}`, rightX, rowY);

      rowY += 40;
      ctx.fillText(`MAX COMBO: x${vrEngine.stats.maxCombo}`, leftX, rowY);
      ctx.fillText(`CALORIES: ~${vrEngine.stats.caloriesBurned} kcal`, rightX, rowY);

      // Interactive Punch/Click Restart Button
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 180, 375, 360, 70, 16);
      ctx.fill();

      ctx.fillStyle = '#070d1a';
      ctx.textAlign = 'center';
      ctx.font = '900 28px monospace';
      ctx.fillText('PUNCH TO RESTART', width / 2, 415);

      texture.needsUpdate = true;
      return;
    }

    // 3. ACTIVE PLAYING HUD
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

    // Recalibration Hint Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '15px monospace';
    ctx.fillText(
      'Press controller [A] or [X] at any time to recalibrate strike center',
      width / 2,
      445
    );

    texture.needsUpdate = true;
  }, []);

  // Subscribe to engine HUD dirty events
  useEffect(() => {
    vrEngine.onHudDirty = () => {
      drawHUD();
    };
    drawHUD();
    return () => {
      vrEngine.onHudDirty = undefined;
    };
  }, [drawHUD]);

  // Periodic redraw for clock & calories + Check punch restart button
  useFrame(() => {
    const now = performance.now();
    // Redraw at ~4 Hz for timer ticking
    if (now - lastDrawnTime.current > 250) {
      lastDrawnTime.current = now;
      drawHUD();
    }

    // Position HUD ahead of player
    if (meshRef.current) {
      const headY = vrEngine.calibration.headY;
      meshRef.current.position.set(0, headY + 0.35, -1.8);
      // Tilt slightly downward toward player
      meshRef.current.rotation.x = 0.12;
    }

    // In Game Over state, check if player punches the restart button
    if (vrEngine.state === 'game_over') {
      const restartCenter = new THREE.Vector3(0, vrEngine.calibration.headY - 0.15, -1.8);
      const hitLeft = vrEngine.hands.left.active && vrEngine.hands.left.position.distanceTo(restartCenter) < 0.45;
      const hitRight = vrEngine.hands.right.active && vrEngine.hands.right.position.distanceTo(restartCenter) < 0.45;
      if (hitLeft || hitRight) {
        vrEngine.startSession(vrEngine.mode, vrEngine.difficulty, camera);
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 1.8, -1.8]}
      onClick={() => {
        if (vrEngine.state === 'game_over') {
          vrEngine.startSession(vrEngine.mode, vrEngine.difficulty, camera);
        }
      }}
    >
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
  );
};
