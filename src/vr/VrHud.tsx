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
      ctx.fillText('[Thumbstick: Recenter Center   •   B / Y: Pause]', width / 2, 430);

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

      // Action control badges
      const btnY = 240;
      const btnW = 270;
      const btnH = 68;
      const gap = 30;
      const startX = (width - (btnW * 3 + gap * 2)) / 2;

      // 1. Resume (A / X)
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.roundRect(startX, btnY, btnW, btnH, 14);
      ctx.fill();

      ctx.fillStyle = '#080e1a';
      ctx.font = '900 24px monospace';
      ctx.fillText('[A / X] RESUME', startX + btnW / 2, btnY + 22);

      // 2. Restart (Grip)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(startX + btnW + gap, btnY, btnW, btnH, 14);
      ctx.fill();

      ctx.fillStyle = '#080e1a';
      ctx.font = '900 24px monospace';
      ctx.fillText('[GRIP] RESTART', startX + btnW + gap + btnW / 2, btnY + 22);

      // 3. Stop & Exit (B / Y)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.roundRect(startX + (btnW + gap) * 2, btnY, btnW, btnH, 14);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = '900 24px monospace';
      ctx.fillText('[B / Y] STOP & EXIT', startX + (btnW + gap) * 2 + btnW / 2, btnY + 22);

      // Footer guidance
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText('Stand inside the floor circle   •   Click Thumbstick to Recenter', width / 2, 380);

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

      // Clean Controller Actions (Replaced "Punch to Restart")
      const btnY = 360;
      const btnW = 320;
      const btnH = 64;
      const gap = 40;
      const startX = (width - (btnW * 2 + gap)) / 2;

      // Play Again Pill
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.roundRect(startX, btnY, btnW, btnH, 14);
      ctx.fill();

      ctx.fillStyle = '#070d1a';
      ctx.textAlign = 'center';
      ctx.font = '900 24px monospace';
      ctx.fillText('[A / X] PLAY AGAIN', startX + btnW / 2, btnY + 20);

      // Back to Menu Pill
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.roundRect(startX + btnW + gap, btnY, btnW, btnH, 14);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fca5a5';
      ctx.textAlign = 'center';
      ctx.font = '900 24px monospace';
      ctx.fillText('[B / Y] BACK TO MENU', startX + btnW + gap + btnW / 2, btnY + 20);

      // Subtext
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '16px monospace';
      ctx.fillText('Press controller buttons (or tap screen with hand)', width / 2, 445);

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
      '[B / Y] Pause   •   [Thumbstick] Recenter   •   [A / X] Recalibrate',
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

  // Periodic redraw for clock & calories + positioning
  useFrame(() => {
    const now = performance.now();
    if (now - lastDrawnTime.current > 250) {
      lastDrawnTime.current = now;
      drawHUD();
    }

    // Position HUD ahead of player in calibrated corridor
    if (meshRef.current) {
      const isPaused = vrEngine.state === 'paused';
      const isSummary = vrEngine.state === 'game_over' || vrEngine.state === 'summary';

      const localY = vrEngine.calibration.headY + (isPaused ? 0.12 : isSummary ? 0.20 : 0.35);
      const localZ = isPaused ? -1.5 : isSummary ? -1.6 : -1.8;

      const localHud = new THREE.Vector3(0, localY, localZ);
      vrEngine.localToWorld(localHud, meshRef.current.position);

      meshRef.current.rotation.y = vrEngine.calibration.forwardYaw;
      meshRef.current.rotation.x = isPaused ? 0.06 : isSummary ? 0.08 : 0.12;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 1.8, -1.8]}
      onClick={() => {
        if (vrEngine.state === 'paused') {
          vrEngine.resumeGame();
        } else if (vrEngine.state === 'game_over' || vrEngine.state === 'summary') {
          vrEngine.restartGame(camera);
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
