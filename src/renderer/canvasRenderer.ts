import {
  CameraMode,
  Landmark3D,
  CalibrationData,
  Point2D,
} from '../types/game';
import { GameEngine } from '../engine/gameEngine';
import { getFistPosition } from '../vision/handTracking';

export class CanvasRenderer {
  public lowPowerMode: boolean = false;
  private slowFrameStreak: number = 0;

  private applyShadow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
    if (this.lowPowerMode || blur <= 0) {
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    engine: GameEngine,
    landmarks: Landmark3D[] | null,
    cameraMode: CameraMode,
    isCalibrating: boolean
  ) {
    const startTime = performance.now();
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

    // Performance monitor for TV chips: auto-downgrade shadow effects if render time exceeds 18ms
    const renderDuration = performance.now() - startTime;
    if (renderDuration > 18) {
      this.slowFrameStreak++;
      if (this.slowFrameStreak > 8) {
        this.lowPowerMode = true;
      }
    } else {
      this.slowFrameStreak = Math.max(0, this.slowFrameStreak - 1);
    }
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
    this.applyShadow(ctx, '#00f3ff', isCalibrating ? 15 : 8);

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

  /**
   * Renders a pulsing glowing edge chevron at the entry border pointing along (vx, vy).
   */
  private renderEdgeTelegraph(
    ctx: CanvasRenderingContext2D,
    spawnX: number,
    spawnY: number,
    vx: number,
    vy: number,
    color: string,
    telegraphRemaining: number,
    telegraphDuration: number,
    width: number,
    height: number
  ) {
    const edgePadding = 26;
    const cx = Math.max(edgePadding, Math.min(width - edgePadding, spawnX * width));
    const cy = Math.max(edgePadding, Math.min(height - edgePadding, spawnY * height));

    const angle = Math.atan2(vy, vx);
    const pulse = 0.5 + 0.5 * Math.sin((telegraphRemaining / telegraphDuration) * Math.PI * 6);
    const alpha = 0.5 + 0.5 * pulse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // 1. Glowing Radar Pip / Origin Anchor
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Double Neon Directional Chevron pointing along (vx, vy)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.applyShadow(ctx, color, 14);

    // Rear Chevron
    ctx.beginPath();
    ctx.moveTo(-10, -13);
    ctx.lineTo(6, 0);
    ctx.lineTo(-10, 13);
    ctx.stroke();

    // Leading Chevron (animated advance)
    const advance = (1 - telegraphRemaining / telegraphDuration) * 5;
    ctx.beginPath();
    ctx.moveTo(-1 + advance, -9);
    ctx.lineTo(13 + advance, 0);
    ctx.lineTo(-1 + advance, 9);
    ctx.stroke();

    // 3. Faint Trajectory Inbound Line Hint
    ctx.strokeStyle = `${color}44`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(80, 0);
    ctx.stroke();

    // 4. Hand Cue for Orbs (L or R)
    if (color !== '#ffd700') {
      const isRight = color.toLowerCase() === '#ff007f' || color.toLowerCase().includes('magenta');
      ctx.save();
      ctx.translate(-22, 0);
      ctx.rotate(-angle); // keep letter upright
      ctx.font = 'bold 11px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      this.applyShadow(ctx, color, 8);
      ctx.fillText(isRight ? 'R' : 'L', 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderPulseOrbs(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
    for (const orb of engine.pulseOrbs) {
      if (orb.isHit || orb.missed || orb.escaped) continue;

      // 1. Edge Telegraph Phase: Render pulsing edge chevron before entry
      if (orb.telegraphRemaining > 0) {
        this.renderEdgeTelegraph(
          ctx,
          orb.spawnX,
          orb.spawnY,
          orb.vx,
          orb.vy,
          orb.color,
          orb.telegraphRemaining,
          orb.telegraphDuration,
          width,
          height
        );
        continue;
      }

      // 2. Active Cross-Screen Traversal Phase
      const x = orb.currentPos.x * width;
      const y = orb.currentPos.y * height;
      const currentRadius = orb.radius;

      ctx.save();

      // 3. Comet Motion Tail trailing behind (-vx, -vy)
      const tailCount = 4;
      const tailSpacing = currentRadius * 0.45;
      for (let t = tailCount; t >= 1; t--) {
        const distBack = t * tailSpacing;
        const tailX = x - orb.vx * distBack;
        const tailY = y - orb.vy * distBack;
        const factor = 1 - t / (tailCount + 1);
        const tailR = currentRadius * (0.3 + factor * 0.55);

        ctx.save();
        ctx.globalAlpha = factor * 0.45;
        ctx.fillStyle = orb.color;
        this.applyShadow(ctx, orb.color, 8);
        ctx.beginPath();
        ctx.arc(tailX, tailY, tailR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Central Target Sphere with Radial Glow
      const grad = ctx.createRadialGradient(
        x - orb.vx * currentRadius * 0.25,
        y - orb.vy * currentRadius * 0.25,
        currentRadius * 0.15,
        x,
        y,
        currentRadius
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, orb.color);
      grad.addColorStop(1, `${orb.color}33`);

      ctx.fillStyle = grad;
      this.applyShadow(ctx, orb.color, 16);
      ctx.beginPath();
      ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // 5. Bright Core Pip & Reticle Crosshair with Hand Letter Indicator
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, currentRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Hand cue letter inside orb core (L for Left/Cyan, R for Right/Magenta)
      const isRight = orb.color.toLowerCase() === '#ff007f' || orb.color.toLowerCase().includes('magenta');
      const handLetter = isRight ? 'R' : 'L';
      ctx.font = `bold ${Math.round(currentRadius * 0.38)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isRight ? '#ff007f' : '#00f3ff';
      ctx.fillText(handLetter, x, y + 1);

      ctx.restore();
    }
  }

  private renderSolarNodes(ctx: CanvasRenderingContext2D, engine: GameEngine, width: number, height: number) {
    for (const node of engine.solarNodes) {
      if (node.isCompleted || node.missed || node.escaped) continue;

      // 1. Edge Telegraph Phase: Render golden pulsing edge chevron
      if (node.telegraphRemaining > 0) {
        this.renderEdgeTelegraph(
          ctx,
          node.spawnX,
          node.spawnY,
          node.vx,
          node.vy,
          '#ffd700',
          node.telegraphRemaining,
          node.telegraphDuration,
          width,
          height
        );
        continue;
      }

      const x = node.currentPos.x * width;
      const y = node.currentPos.y * height;
      // Pulse node slightly larger when grabbed and locked on
      const isHeld = node.isHeld;
      const pulseMult = isHeld ? 1.14 + 0.04 * Math.sin(performance.now() * 0.025) : 1.0;
      const r = node.radius * pulseMult;

      ctx.save();

      // 2. Electric Tether Line between Grabbing Hand Cursor and Node Center
      if (isHeld && node.heldHandPos) {
        const hx = node.heldHandPos.x * width;
        const hy = node.heldHandPos.y * height;

        ctx.save();
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 3.5;
        this.applyShadow(ctx, '#39ff14', 18);

        // Jagged animated electric arc
        const segments = 4;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          const jitterX = (Math.random() - 0.5) * 14;
          const jitterY = (Math.random() - 0.5) * 14;
          ctx.lineTo(hx + (x - hx) * t + jitterX, hy + (y - hy) * t + jitterY);
        }
        ctx.lineTo(x, y);
        ctx.stroke();

        // Contact spark pip at hand
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, hy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Faint Dotted Path Hint Line Ahead Showing Drift Direction
      if (!isHeld) {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + node.vx * 80, y + node.vy * 80);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. Rotating Golden Solar Flares
      const time = performance.now() / 800;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.restore();

      // 4. Ambient Glowing Core
      const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(0.4, '#f59e0b');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

      ctx.fillStyle = grad;
      this.applyShadow(ctx, '#ffd700', 20);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // 5. Circular Charge Progress Bar (0 -> 100%)
      const progress = node.currentHoldTime / node.holdDurationRequired;
      if (progress > 0) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 6;
        this.applyShadow(ctx, '#39ff14', 15);
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

      // 6. "HOLD" Label
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      this.applyShadow(ctx, '#000000', 4);
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

          // Warning text banner scaled to canvas width
          const squatFontSize = Math.max(14, Math.min(26, width * 0.04));
          ctx.font = `bold ${Math.round(squatFontSize)}px Orbitron, sans-serif`;
          ctx.fillStyle = '#ff1a40';
          ctx.textAlign = 'center';
          this.applyShadow(ctx, '#ff1a40', 15);
          ctx.fillText('⚠ SQUAT / DUCK NOW! ⚠', width * 0.5, squatY * 0.5);
        } else if (isActive) {
          // Active Laser Wall
          ctx.fillStyle = 'rgba(255, 26, 64, 0.65)';
          ctx.fillRect(0, 0, width, squatY);

          // Intense Laser Beam Line
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 6;
          this.applyShadow(ctx, '#ff1a40', 25);
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

          const leanFontSize = Math.max(11, Math.min(22, width * 0.035));
          ctx.font = `bold ${Math.round(leanFontSize)}px Orbitron, sans-serif`;
          ctx.fillStyle = '#ff1a40';
          ctx.textAlign = 'center';
          this.applyShadow(ctx, '#ff1a40', 15);
          ctx.fillText(directionText, textX, height * 0.45);
        } else if (isActive) {
          ctx.fillStyle = 'rgba(255, 26, 64, 0.65)';
          ctx.fillRect(startX, 0, beamWidth, height);

          const beamX = isLeft ? width * 0.5 : width * 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 6;
          this.applyShadow(ctx, '#ff1a40', 25);
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
    const leftFist = getFistPosition(landmarks, 'left');
    const rightFist = getFistPosition(landmarks, 'right');

    const drawReticle = (pt: Point2D | null, color: string, hand: 'left' | 'right') => {
      if (!pt) return;
      const x = pt.x * width;
      const y = pt.y * height;
      const vel = engine.collision.getWristVelocity(hand);
      const isFast = vel > 1.2;

      ctx.save();
      ctx.translate(x, y);

      // Proportional reticle scaling based on screen dimensions (scales dynamically on phone screens)
      const minDim = Math.min(width, height);
      const reticleScale = Math.min(1.0, Math.max(0.65, minDim / 800));
      const baseRadius = (44 + Math.min(28, vel * 14)) * reticleScale;

      ctx.strokeStyle = isFast ? '#ffffff' : color;
      ctx.lineWidth = (isFast ? 5.0 : 3.5) * reticleScale;
      this.applyShadow(ctx, isFast ? '#ffffff' : color, (isFast ? 24 : 14) * reticleScale);

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner tactical dashed ring
      ctx.save();
      ctx.strokeStyle = isFast ? 'rgba(255, 255, 255, 0.7)' : `${color}88`;
      ctx.lineWidth = 2.0 * reticleScale;
      ctx.setLineDash([5 * reticleScale, 7 * reticleScale]);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Glowing center core pip
      ctx.fillStyle = isFast ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * reticleScale, 0, Math.PI * 2);
      ctx.fill();

      // Center bright core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4 * reticleScale, 0, Math.PI * 2);
      ctx.fill();

      // Crosshair tick marks (compass axes)
      ctx.strokeStyle = isFast ? '#ffffff' : color;
      ctx.lineWidth = (isFast ? 3.5 : 2.5) * reticleScale;
      const tickStart = baseRadius - 6 * reticleScale;
      const tickEnd = baseRadius + 10 * reticleScale;

      ctx.beginPath();
      // Left tick
      ctx.moveTo(-tickEnd, 0);
      ctx.lineTo(-tickStart, 0);
      // Right tick
      ctx.moveTo(tickStart, 0);
      ctx.lineTo(tickEnd, 0);
      // Top tick
      ctx.moveTo(0, -tickEnd);
      ctx.lineTo(0, -tickStart);
      // Bottom tick
      ctx.moveTo(0, tickStart);
      ctx.lineTo(0, tickEnd);
      ctx.stroke();

      // Sleek hand tag (L / R)
      ctx.font = 'bold 11px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isFast ? '#ffffff' : color;
      ctx.fillText(hand === 'left' ? 'L' : 'R', 0, -baseRadius - 16);

      ctx.restore();
    };

    drawReticle(leftFist, '#00f3ff', 'left');
    drawReticle(rightFist, '#ff007f', 'right');
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
