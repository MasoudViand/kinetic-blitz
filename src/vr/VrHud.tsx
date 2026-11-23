import React, { useRef, useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { vrEngine } from './vrEngine';
import { vrUiRegistry } from './vrUi';
import { VrButton } from './VrButton';

interface VrHudProps {
  onExitSession?: () => void;
}

export const VrHud: React.FC<VrHudProps> = ({ onExitSession }) => {
  const { camera } = useThree();

  // Root groups for peripheral widgets and center panel
  const leftWingRef = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);
  const topBarRef = useRef<THREE.Group>(null);
  const centerPanelRef = useRef<THREE.Group>(null);

  // Mesh refs for raycasting
  const leftWingMeshRef = useRef<THREE.Mesh>(null);
  const rightWingMeshRef = useRef<THREE.Mesh>(null);
  const topBarMeshRef = useRef<THREE.Mesh>(null);
  const centerPanelMeshRef = useRef<THREE.Mesh>(null);

  // State synchronization
  const [engineState, setEngineState] = useState(vrEngine.state);

  // Dirty-flag tracking for independent 90 FPS redraws
  const lastScoreDrawn = useRef<number>(-1);
  const lastOverdriveDrawn = useRef<number>(-1);
  const lastComboDrawn = useRef<number>(-1);
  const lastOverdriveStateDrawn = useRef<boolean>(false);
  const lastSecondDrawn = useRef<number>(-1);

  // Combo scale-pop animation (1.0 -> 1.14 -> 1.0)
  const lastComboSeen = useRef<number>(vrEngine.stats.combo);
  const comboScalePop = useRef<number>(1.0);

  // Sync onExitSession with engine
  useEffect(() => {
    if (onExitSession) {
      vrEngine.onExitSession = onExitSession;
    }
    return () => {
      vrEngine.onExitSession = undefined;
    };
  }, [onExitSession]);

  // =========================================================================
  // 1. LEFT WING WIDGET (Score & Overdrive) — 0.52m x 0.30m
  // =========================================================================
  const { canvas: leftCanvas, texture: leftTexture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 295;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, []);

  const drawLeftWing = useCallback((score: number, overdrive: number, isOverdrive: boolean) => {
    const ctx = leftCanvas.getContext('2d');
    if (!ctx) return;
    const w = leftCanvas.width;
    const h = leftCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Minimal borderless dark-glass backing
    ctx.fillStyle = 'rgba(6, 10, 22, 0.32)';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 20);
    ctx.fill();

    // Thin neon cyan accent line at bottom
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(28, h - 14);
    ctx.lineTo(w - 28, h - 14);
    ctx.stroke();

    // SCORE Label & Clean Digits
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('SCORE', 34, 48);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px monospace';
    ctx.fillText(`${score}`, 34, 116);

    // Overdrive status & bar
    ctx.fillStyle = isOverdrive ? '#ff0077' : '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(isOverdrive ? '🔥 OVERDRIVE ACTIVE (2X) 🔥' : 'BLITZ OVERDRIVE', 34, 172);

    const barX = 34;
    const barY = 192;
    const barW = w - 68;
    const barH = 22;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 6);
    ctx.fill();

    const fillW = (Math.max(0, Math.min(100, overdrive)) / 100) * barW;
    if (fillW > 0) {
      const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#ff0077');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 6);
      ctx.fill();
    }

    leftTexture.needsUpdate = true;
  }, [leftCanvas, leftTexture]);

  // Synchronous initial draw for Left Wing
  useLayoutEffect(() => {
    drawLeftWing(vrEngine.stats.score, vrEngine.stats.overdrive, vrEngine.stats.isOverdrive);
    lastScoreDrawn.current = vrEngine.stats.score;
    lastOverdriveDrawn.current = Math.floor(vrEngine.stats.overdrive);
  }, [drawLeftWing]);

  // =========================================================================
  // 2. RIGHT WING WIDGET (Combo & Multiplier) — 0.52m x 0.30m
  // =========================================================================
  const { canvas: rightCanvas, texture: rightTexture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 295;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, []);

  const drawRightWing = useCallback((combo: number, isOverdrive: boolean, hits: number, dodges: number) => {
    const ctx = rightCanvas.getContext('2d');
    if (!ctx) return;
    const w = rightCanvas.width;
    const h = rightCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Minimal borderless dark-glass backing
    ctx.fillStyle = 'rgba(6, 10, 22, 0.32)';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 20);
    ctx.fill();

    // Thin neon magenta accent line at bottom
    ctx.strokeStyle = '#ff0077';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(28, h - 14);
    ctx.lineTo(w - 28, h - 14);
    ctx.stroke();

    // COMBO STREAK
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('COMBO STREAK', 34, 48);

    const comboColor = combo >= 8 ? '#ff0077' : combo > 1 ? '#ffd700' : '#ffffff';
    ctx.fillStyle = comboColor;
    ctx.font = '900 68px monospace';
    ctx.fillText(combo > 1 ? `${combo}x` : '1x', 34, 116);

    // Multiplier state
    const mult = Math.min(combo, 10);
    ctx.fillStyle = isOverdrive ? '#ff0077' : '#00f0ff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(
      isOverdrive ? '2X MULTIPLIER BOOST' : `${mult}X SCORE MULTIPLIER`,
      34,
      172
    );

    // Secondary Telemetry
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px monospace';
    ctx.fillText(`PUNCHES: ${hits}   DODGES: ${dodges}`, 34, 220);

    rightTexture.needsUpdate = true;
  }, [rightCanvas, rightTexture]);

  // Synchronous initial draw for Right Wing
  useLayoutEffect(() => {
    drawRightWing(
      vrEngine.stats.combo,
      vrEngine.stats.isOverdrive,
      vrEngine.stats.pulseHits,
      vrEngine.stats.lasersDodged
    );
    lastComboDrawn.current = vrEngine.stats.combo;
    lastOverdriveStateDrawn.current = vrEngine.stats.isOverdrive;
  }, [drawRightWing]);

  // =========================================================================
  // 3. TOP SLIM BAR WIDGET (Timer & Pause Button) — 0.68m x 0.16m
  // =========================================================================
  const { canvas: topCanvas, texture: topTexture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 680;
    c.height = 160;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, []);

  const drawTopBar = useCallback((secondsRemaining: number, mode: string, difficulty: string) => {
    const ctx = topCanvas.getContext('2d');
    if (!ctx) return;
    const w = topCanvas.width;
    const h = topCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Slim horizontal bar backing
    ctx.fillStyle = 'rgba(6, 10, 22, 0.38)';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 18);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mode & Difficulty Tag
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${mode.toUpperCase()} • ${difficulty.toUpperCase()}`, 28, 42);

    // Time Remaining Readout
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    const timeStr = mode === 'endless' ? '∞' : `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    ctx.fillStyle = secondsRemaining <= 10 && mode !== 'endless' ? '#ff0055' : '#00f0ff';
    ctx.font = '900 54px monospace';
    ctx.fillText(timeStr, 28, 108);

    // Subtle divider line before Pause button area
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(330, 20);
    ctx.lineTo(330, h - 20);
    ctx.stroke();

    topTexture.needsUpdate = true;
  }, [topCanvas, topTexture]);

  // Synchronous initial draw for Top Bar
  useLayoutEffect(() => {
    const sec = Math.max(0, Math.ceil(vrEngine.timeRemaining));
    drawTopBar(sec, vrEngine.mode, vrEngine.difficulty);
    lastSecondDrawn.current = sec;
  }, [drawTopBar]);

  // =========================================================================
  // 4. CENTER PANEL (Countdown / Paused / Summary) — 1.5m x 0.75m
  // =========================================================================
  const { canvas: centerCanvas, texture: centerTexture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, texture: tex };
  }, []);

  const drawCenterPanel = useCallback(() => {
    const ctx = centerCanvas.getContext('2d');
    if (!ctx) return;
    const w = centerCanvas.width;
    const h = centerCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const state = vrEngine.state;

    // Background panel with neon border
    ctx.fillStyle = state === 'paused' ? 'rgba(8, 12, 22, 0.94)' : 'rgba(7, 13, 26, 0.90)';
    ctx.beginPath();
    ctx.roundRect(16, 16, w - 32, h - 32, 28);
    ctx.fill();

    // Glowing border
    ctx.strokeStyle = state === 'paused' ? '#f59e0b' : '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 1. COUNTDOWN STATE
    if (state === 'countdown') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('STRIKE CALIBRATION ACTIVE', w / 2, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 130px monospace';
      const count = Math.max(1, Math.ceil(vrEngine.timeRemaining > 0 ? 3 - (vrEngine.elapsedTime % 3) : 3));
      ctx.fillText(`${count}`, w / 2, 260);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('RAISE FISTS • PUNCH APPROACHING ORBS', w / 2, 380);

      ctx.fillStyle = '#00f0ff';
      ctx.font = '18px monospace';
      ctx.fillText('Aim laser & pull Trigger to click menus   •   Thumbstick: Recenter', w / 2, 430);

      centerTexture.needsUpdate = true;
      return;
    }

    // 2. PAUSED STATE
    if (state === 'paused') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('KINETIC BLITZ VR', w / 2, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 60px monospace';
      ctx.fillText('GAME PAUSED', w / 2, 85);

      const seconds = Math.max(0, Math.ceil(vrEngine.timeRemaining));
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timeStr = vrEngine.mode === 'endless' ? '∞' : `${mins}:${secs < 10 ? '0' : ''}${secs}`;

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `SCORE: ${vrEngine.stats.score}   •   COMBO: x${vrEngine.stats.combo}   •   TIME: ${timeStr}`,
        w / 2,
        170
      );

      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText('Point controller & pull Trigger to select   •   Thumbstick: Recenter', w / 2, 380);

      centerTexture.needsUpdate = true;
      return;
    }

    // 3. SUMMARY STATE
    if (state === 'game_over' || state === 'summary') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('KINETIC BLITZ VR', w / 2, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px monospace';
      ctx.fillText('WORKOUT COMPLETE!', w / 2, 75);

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
      ctx.fillText(`SCORE: ${vrEngine.stats.score} (RANK ${rank})`, w / 2, 140);

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

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '16px monospace';
      ctx.fillText('Point controller & pull Trigger to select   •   Thumbstick: Recenter', w / 2, 445);

      centerTexture.needsUpdate = true;
      return;
    }

    centerTexture.needsUpdate = true;
  }, [centerCanvas, centerTexture]);

  // Synchronous initial draw for Center Panel
  useLayoutEffect(() => {
    drawCenterPanel();
  }, [drawCenterPanel]);

  // Dispose all canvas textures on unmount
  useEffect(() => {
    return () => {
      leftTexture.dispose();
      rightTexture.dispose();
      topTexture.dispose();
      centerTexture.dispose();
    };
  }, [leftTexture, rightTexture, topTexture, centerTexture]);

  // Register active HUD planes with VR UI Registry for laser ray aiming detection
  useEffect(() => {
    const isPlay = engineState === 'playing';
    const planes: THREE.Object3D[] = [];

    if (isPlay) {
      if (topBarMeshRef.current) planes.push(topBarMeshRef.current);
      if (leftWingMeshRef.current) planes.push(leftWingMeshRef.current);
      if (rightWingMeshRef.current) planes.push(rightWingMeshRef.current);
    } else {
      if (centerPanelMeshRef.current) planes.push(centerPanelMeshRef.current);
    }

    vrUiRegistry.setHudPlanes(planes);

    return () => {
      vrUiRegistry.setHudPlanes([]);
    };
  }, [engineState]);

  // Subscribe to engine HUD dirty events
  useEffect(() => {
    vrEngine.onHudDirty = () => {
      setEngineState(vrEngine.state);
      drawCenterPanel();
    };
    return () => {
      vrEngine.onHudDirty = undefined;
    };
  }, [drawCenterPanel]);

  // Per-frame transforms & independent dirty-flagged redraws
  useFrame((_, delta) => {
    const state = vrEngine.state;
    if (state !== engineState) {
      setEngineState(state);
    }

    const headY = vrEngine.calibration.headY;
    const yaw = vrEngine.calibration.forwardYaw;
    const isPlaying = state === 'playing';

    // 1. POSITION PERIPHERAL WIDGETS (Only active during PLAYING)
    if (isPlaying) {
      // Left Wing: localX = -1.05m, localY = headY - 0.10m, localZ = -2.2m, rotationY = +0.42 rad (~24°)
      if (leftWingRef.current) {
        const localLeft = new THREE.Vector3(-1.05, headY - 0.10, -2.2);
        vrEngine.localToWorld(localLeft, leftWingRef.current.position);
        leftWingRef.current.rotation.set(0, yaw + 0.42, 0);
      }

      // Right Wing: localX = +1.05m, localY = headY - 0.10m, localZ = -2.2m, rotationY = -0.42 rad (~-24°)
      if (rightWingRef.current) {
        const localRight = new THREE.Vector3(1.05, headY - 0.10, -2.2);
        vrEngine.localToWorld(localRight, rightWingRef.current.position);
        rightWingRef.current.rotation.set(0, yaw - 0.42, 0);

        // Combo scale-pop animation (1.0 -> 1.14 -> 1.0)
        if (vrEngine.stats.combo > lastComboSeen.current) {
          comboScalePop.current = 1.14;
        }
        lastComboSeen.current = vrEngine.stats.combo;

        if (comboScalePop.current > 1.0) {
          comboScalePop.current += (1.0 - comboScalePop.current) * Math.min(1, delta * 12);
          rightWingRef.current.scale.set(
            comboScalePop.current,
            comboScalePop.current,
            comboScalePop.current
          );
        } else {
          rightWingRef.current.scale.set(1, 1, 1);
        }
      }

      // Top Slim Bar: localX = 0, localY = headY + 0.68m, localZ = -2.2m, rotationX = +0.24 rad (~14°)
      if (topBarRef.current) {
        const localTop = new THREE.Vector3(0, headY + 0.68, -2.2);
        vrEngine.localToWorld(localTop, topBarRef.current.position);
        topBarRef.current.rotation.set(0.24, yaw, 0);
      }

      // Independent dirty-flagged redraws
      // A. Left Wing dirty check (Score or Overdrive changed)
      const currentScore = vrEngine.stats.score;
      const currentOverdrive = Math.floor(vrEngine.stats.overdrive);
      if (currentScore !== lastScoreDrawn.current || currentOverdrive !== lastOverdriveDrawn.current) {
        lastScoreDrawn.current = currentScore;
        lastOverdriveDrawn.current = currentOverdrive;
        drawLeftWing(currentScore, vrEngine.stats.overdrive, vrEngine.stats.isOverdrive);
      }

      // B. Right Wing dirty check (Combo or Overdrive state changed)
      const currentCombo = vrEngine.stats.combo;
      const currentIsOverdrive = vrEngine.stats.isOverdrive;
      if (currentCombo !== lastComboDrawn.current || currentIsOverdrive !== lastOverdriveStateDrawn.current) {
        lastComboDrawn.current = currentCombo;
        lastOverdriveStateDrawn.current = currentIsOverdrive;
        drawRightWing(
          currentCombo,
          currentIsOverdrive,
          vrEngine.stats.pulseHits,
          vrEngine.stats.lasersDodged
        );
      }

      // C. Top Bar dirty check (Whole second changed — once per sec)
      const currentSecond = Math.max(0, Math.ceil(vrEngine.timeRemaining));
      if (currentSecond !== lastSecondDrawn.current) {
        lastSecondDrawn.current = currentSecond;
        drawTopBar(currentSecond, vrEngine.mode, vrEngine.difficulty);
      }
    }

    // 2. POSITION CENTER PANEL (Countdown, Paused, Summary)
    if (!isPlaying && centerPanelRef.current) {
      const isPaused = state === 'paused';
      const isSummary = state === 'game_over' || state === 'summary';

      // Comfortable eye-level position when stopped: localZ = -1.6m, localY = headY - 0.05m
      const localY = isPaused || isSummary ? headY - 0.05 : headY + 0.10;
      const localZ = -1.6;

      const localCenter = new THREE.Vector3(0, localY, localZ);
      vrEngine.localToWorld(localCenter, centerPanelRef.current.position);

      centerPanelRef.current.rotation.set(0.05, yaw, 0);
    }
  });

  const isPlaying = engineState === 'playing';
  const isPaused = engineState === 'paused';
  const isSummary = engineState === 'game_over' || engineState === 'summary';
  const isCountdown = engineState === 'countdown';

  return (
    <group>
      {/* ================================================================= */}
      {/* ACTIVE PLAYING: 3 PERIPHERAL WIDGETS (CENTRAL CORRIDOR 100% CLEAR)*/}
      {/* ================================================================= */}
      {isPlaying && (
        <>
          {/* 1. Left Wing — Score & Overdrive (-1.05m X, -2.2m Z, +24° Y) */}
          <group ref={leftWingRef} position={[-1.05, 1.55, -2.2]}>
            <mesh ref={leftWingMeshRef}>
              <planeGeometry args={[0.52, 0.30]} />
              <meshBasicMaterial
                map={leftTexture}
                transparent
                toneMapped={false}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>

          {/* 2. Right Wing — Combo & Multiplier (+1.05m X, -2.2m Z, -24° Y) */}
          <group ref={rightWingRef} position={[1.05, 1.55, -2.2]}>
            <mesh ref={rightWingMeshRef}>
              <planeGeometry args={[0.52, 0.30]} />
              <meshBasicMaterial
                map={rightTexture}
                transparent
                toneMapped={false}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>

          {/* 3. Top Slim Bar — Timer & Clickable Pause Button (+0.68m Y, -2.2m Z, +14° X) */}
          <group ref={topBarRef} position={[0, 2.33, -2.2]}>
            <mesh ref={topBarMeshRef}>
              <planeGeometry args={[0.68, 0.16]} />
              <meshBasicMaterial
                map={topTexture}
                transparent
                toneMapped={false}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            {/* Compact Clickable 3D PAUSE Button on right side of top bar */}
            <VrButton
              id="hud-pause"
              label="PAUSE"
              sublabel="[B/Y]"
              width={0.22}
              height={0.09}
              position={[0.17, 0, 0.02]}
              color="#f59e0b"
              hoverColor="#fbbf24"
              onClick={() => vrEngine.pauseGame()}
            />
          </group>
        </>
      )}

      {/* ================================================================= */}
      {/* STOPPED STATES: CENTERED PANELS AT EYE LEVEL (Z = -1.6m)          */}
      {/* ================================================================= */}
      {(isCountdown || isPaused || isSummary) && (
        <group ref={centerPanelRef} position={[0, 1.6, -1.6]}>
          {/* Centered Panel Background Canvas */}
          <mesh ref={centerPanelMeshRef}>
            <planeGeometry args={[1.5, 0.75]} />
            <meshBasicMaterial
              map={centerTexture}
              transparent
              toneMapped={false}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* PAUSED: Clickable 3D RESUME, RESTART, STOP & EXIT Buttons */}
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

          {/* SUMMARY: Clickable 3D PLAY AGAIN and BACK TO MENU Buttons */}
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
      )}
    </group>
  );
};
