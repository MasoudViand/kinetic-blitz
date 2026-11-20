import {
  CameraMode,
  Landmark3D,
  CalibrationData,
} from '../types/game';
import { GameEngine } from '../engine/gameEngine';

export class CanvasRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    landmarks: Landmark3D[] | null,
    cameraMode: CameraMode,
    isCalibrating: boolean
  ) {
    ctx.save();

    // 1. Clear & Screen Shake
    ctx.clearRect(0, 0, width, height);

    if (cameraMode === 'silhouette' || cameraMode === 'hidden') {
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, width, height);
      this.drawCyberGrid(ctx, width, height);
    }

    if (engine.screenShake > 0) {
      const shakeX = (Math.random() * 2 - 1) * engine.screenShake;
      const shakeY = (Math.random() * 2 - 1) * engine.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 2. Render Avatar Silhouette if enabled or in silhouette mode
    if (landmarks && (cameraMode === 'silhouette' || isCalibrating)) {
      this.renderSkeleton(ctx, landmarks, width, height, isCalibrating);
    }

    // 3. Render Laser Barriers (background threat layer)
    this.renderLaserBarriers(ctx, engine, width, height);

    // 4. Render Solar Nodes
    this.renderSolarNodes(ctx, engine, width, height);

    // 5. Render Pulse Orbs (approaching 3D targets)
    this.renderPulseOrbs(ctx, engine, width, height);

    // 6. Render Hand Cursors
    if (landmarks) {
      this.renderHandReticles(ctx, landmarks, width, height, engine);
    }

    // 7. Render Particle System & Floating Score Text
    engine.particles.render(ctx);

    ctx.restore();
  }

  private drawCyberGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark3D[],
    width: number,
    height: number,
    isCalibrating: boolean
  ) {
    ctx.save();
    const color = isCalibrating ? 'rgba(0, 243, 255, 0.8)' : 'rgba(56, 189, 248, 0.45)';
    ctx.strokeStyle = color;
    ctx.lineWidth = isCalibrating ? 3 : 2;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = isCalibrating ? 15 : 8;

    // Body connections
    const bones: [number, number][] = [
      [11, 12], // Shoulders
      [11, 13], [13, 15], // Left arm
      [12, 14], [14, 16], // Right arm
      [11, 23], [12, 24], // Torso
      [23, 24], // Hips
      [23, 25], [25, 27], // Left leg
      [24, 26], [26, 28], // Right leg
    ];

    bones.forEach(([i, j]) => {
      const a = landmarks[i];
      const b = landmarks[j];
      if (a && b && (a.visibility ?? 1) > 0.4 && (b.visibility ?? 1) > 0.4) {
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      }
    });

    // Draw Head Circle
    const nose = landmarks[0];
    if (nose && (nose.visibility ?? 1) > 0.4) {
      ctx.fillStyle = isCalibrating ? '#00f3ff' : 'rgba(0, 243, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(nose.x * width, nose.y * height, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderPulseOrbs(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
    for (const orb of engine.pulseOrbs) {
      const x = orb.currentPos.x * width;
      const y = orb.currentPos.y * height;
      const originX = orb.originPos.x * width;
      const originY = orb.originPos.y * height;
      const currentRadius = orb.radius * orb.scale;

      ctx.save();

      // 1. Approaching Trajectory Vector Line
      ctx.strokeStyle = `${orb.color}33`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Outer Shrinking Timing Ring
      const ringRadius = currentRadius * orb.timingRingScale;
      const isHitWindow = orb.scale >= 0.75 && orb.scale <= 1.15;

      ctx.strokeStyle = isHitWindow ? '#ffffff' : orb.color;
      ctx.lineWidth = isHitWindow ? 3.5 : 2;
      ctx.shadowColor = isHitWindow ? '#ffffff' : orb.color;
      ctx.shadowBlur = isHitWindow ? 16 : 8;

      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 3. Central Target Sphere with Radial Glow
      const grad = ctx.createRadialGradient(x - currentRadius * 0.3, y - currentRadius * 0.3, currentRadius * 0.1, x, y, currentRadius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, orb.color);
      grad.addColorStop(1, `${orb.color}22`);

      ctx.fillStyle = grad;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Center Target Crosshair / Reticle
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const crossSize = Math.max(6, currentRadius * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - crossSize, y);
      ctx.lineTo(x + crossSize, y);
      ctx.moveTo(x, y - crossSize);
      ctx.lineTo(x, y + crossSize);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderSolarNodes(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
    for (const node of engine.solarNodes) {
      const x = node.currentPos.x * width;
      const y = node.currentPos.y * height;
      const r = node.radius;

      ctx.save();

      // 1. Rotating Golden Solar Flares
      const time = performance.now() / 800;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.restore();

      // 2. Ambient Glowing Core
      const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(0.4, '#f59e0b');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

      ctx.fillStyle = grad;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 3. Circular Charge Progress Bar (0 -> 100%)
      const progress = node.currentHoldTime / node.holdDurationRequired;
      if (progress > 0) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. "HOLD" Label
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(progress > 0 ? `${Math.round(progress * 100)}%` : 'HOLD', x, y);

      ctx.restore();
    }
  }

  private renderLaserBarriers(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
    const now = performance.now();

    for (const barrier of engine.laserBarriers) {
      const elapsed = now - barrier.spawnTime;
      const isWarning = elapsed < barrier.warningDuration;
      const isActive = elapsed >= barrier.warningDuration && elapsed < barrier.warningDuration + barrier.activeDuration;

      ctx.save();

      if (barrier.orientation === 'horizontal_squat') {
        const squatY = (engine.calibration.headY + 0.12) * height;

        if (isWarning) {
          // Warning Telegraph: Flashing Hazard Grid
          const alpha = (Math.sin(elapsed / 100 * Math.PI) + 1) / 2 * 0.45 + 0.1;
          ctx.fillStyle = `rgba(255, 26, 64, ${alpha})`;
          ctx.fillRect(0, 0, width, squatY);

          // Warning text banner
          ctx.font = 'bold 26px Orbitron, sans-serif';
          ctx.fillStyle = '#ff1a40';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#ff1a40';
          ctx.shadowBlur = 15;
          ctx.fillText('⚠ SQUAT / DUCK NOW! ⚠', width * 0.5, squatY * 0.5);
        } else if (isActive) {
          // Active Laser Wall
          ctx.fillStyle = 'rgba(255, 26, 64, 0.65)';
          ctx.fillRect(0, 0, width, squatY);

          // Intense Laser Beam Line
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 6;
          ctx.shadowColor = '#ff1a40';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.moveTo(0, squatY);
          ctx.lineTo(width, squatY);
          ctx.stroke();
        }
      } else if (barrier.orientation === 'vertical_left' || barrier.orientation === 'vertical_right') {
        const isLeft = barrier.orientation === 'vertical_left';
        const startX = isLeft ? 0 : width * 0.5;
        const beamWidth = width * 0.5;
        const textX = isLeft ? width * 0.25 : width * 0.75;
        const directionText = isLeft ? '➡ LEAN / STEP RIGHT ➡' : '⬅ LEAN / STEP LEFT ⬅';

        if (isWarning) {
          const alpha = (Math.sin(elapsed / 100 * Math.PI) + 1) / 2 * 0.45 + 0.1;
          ctx.fillStyle = `rgba(255, 26, 64, ${alpha})`;
          ctx.fillRect(startX, 0, beamWidth, height);

          ctx.font = 'bold 24px Orbitron, sans-serif';
          ctx.fillStyle = '#ff1a40';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#ff1a40';
          ctx.shadowBlur = 15;
          ctx.fillText(directionText, textX, height * 0.45);
        } else if (isActive) {
          ctx.fillStyle = 'rgba(255, 26, 64, 0.65)';
          ctx.fillRect(startX, 0, beamWidth, height);

          const beamX = isLeft ? width * 0.5 : width * 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 6;
          ctx.shadowColor = '#ff1a40';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.moveTo(beamX, 0);
          ctx.lineTo(beamX, height);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  private renderHandReticles(
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark3D[],
    width: number,
    height: number,
    engine: GameEngine
  ) {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const drawReticle = (lm: Landmark3D | undefined, color: string, hand: 'left' | 'right') => {
      if (!lm || (lm.visibility ?? 1) < 0.45) return;
      const x = lm.x * width;
      const y = lm.y * height;
      const vel = engine.collision.getWristVelocity(hand);
      const isFast = vel > 1.2;

      ctx.save();
      ctx.translate(x, y);

      // Pulsing outer ring
      const baseRadius = 24 + Math.min(16, vel * 8);
      ctx.strokeStyle = isFast ? '#ffffff' : color;
      ctx.lineWidth = isFast ? 3.5 : 2.5;
      ctx.shadowColor = isFast ? '#ffffff' : color;
      ctx.shadowBlur = isFast ? 18 : 10;

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing center pip
      ctx.fillStyle = isFast ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Crosshair tick marks
      ctx.beginPath();
      ctx.moveTo(-baseRadius - 5, 0);
      ctx.lineTo(-baseRadius + 5, 0);
      ctx.moveTo(baseRadius - 5, 0);
      ctx.lineTo(baseRadius + 5, 0);
      ctx.moveTo(0, -baseRadius - 5);
      ctx.lineTo(0, -baseRadius + 5);
      ctx.moveTo(0, baseRadius - 5);
      ctx.lineTo(0, baseRadius + 5);
      ctx.stroke();

      ctx.restore();
    };

    drawReticle(leftWrist, '#00f3ff', 'left');
    drawReticle(rightWrist, '#ff007f', 'right');
  }

  public renderCalibrationGuide(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    calibration: CalibrationData
  ) {
    ctx.save();
    const cx = calibration.shoulderCenter.x * width;
    const cy = calibration.shoulderCenter.y * height;
    const sw = calibration.shoulderWidth * width;

    // Draw reach boundary ellipses
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, sw * 1.8, sw * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

export const canvasRenderer = new CanvasRenderer();
