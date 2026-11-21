import { CalibrationData, PulseOrbTarget, SolarNodeTarget, LaserBarrierTarget, Point2D, DifficultyLevel, PostureType } from '../types/game';

export interface CrossScreenTrajectory {
  anchorPos: Point2D;
  spawnX: number;
  spawnY: number;
  exitX: number;
  exitY: number;
  vx: number;
  vy: number;
  arcOffset: number;
  telegraphDuration: number;
}

export class TargetFactory {
  private idCounter = 0;
  private lastTheta: number = -1;

  private nextId(prefix: string): string {
    return `${prefix}_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Ray-casts from an anchor point inside the screen to find the exact boundary intersection
   * with viewport border padding [-pad, 1+pad].
   */
  private rayBoxIntersection(
    ax: number,
    ay: number,
    dx: number,
    dy: number,
    pad: number = 0.08
  ): Point2D {
    const minX = -pad;
    const maxX = 1 + pad;
    const minY = -pad;
    const maxY = 1 + pad;

    let tMin = Infinity;

    if (dx > 0.0001) {
      const t = (maxX - ax) / dx;
      if (t > 0 && t < tMin) tMin = t;
    } else if (dx < -0.0001) {
      const t = (minX - ax) / dx;
      if (t > 0 && t < tMin) tMin = t;
    }

    if (dy > 0.0001) {
      const t = (maxY - ay) / dy;
      if (t > 0 && t < tMin) tMin = t;
    } else if (dy < -0.0001) {
      const t = (minY - ay) / dy;
      if (t > 0 && t < tMin) tMin = t;
    }

    if (!isFinite(tMin) || tMin <= 0) {
      tMin = 1.0;
    }

    return {
      x: ax + tMin * dx,
      y: ay + tMin * dy,
    };
  }

  /**
   * Generates a 360° Edge-to-Opposite-Edge trajectory passing through the player's calibrated reach box.
   */
  public createCrossScreenTrajectory(
    calibration: CalibrationData,
    postureMode: PostureType = calibration.posture
  ): CrossScreenTrajectory {
    const isSeated = postureMode === 'seated';
    const center = calibration.shoulderCenter;
    const sw = calibration.shoulderWidth || 0.22;

    // 1. Choose reachable anchor point inside user's calibrated reach volume
    let anchorX: number;
    let anchorY: number;

    if (isSeated) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const reachX = 0.6 + Math.random() * 0.7; // Moderate lateral reach for seated
      anchorX = Math.max(0.18, Math.min(0.82, center.x + side * (reachX * sw)));
      // Clamp anchorY to upper-body bounds (strictly comfortable upper body / chest / head reach)
      anchorY = Math.max(0.22, Math.min(0.68, center.y + (Math.random() * 0.25 - 0.15)));
    } else {
      const side = Math.random() > 0.5 ? 1 : -1;
      const reachX = 0.8 + Math.random() * 1.2;
      anchorX = Math.max(0.15, Math.min(0.85, center.x + side * (reachX * sw)));
      anchorY = Math.max(0.18, Math.min(0.78, center.y + (Math.random() * 0.38 - 0.18)));
    }

    // 2. Choose entry angle theta across 360° perimeter
    // Avoid consecutive angles within 35° (0.61 rad) and avoid flat floor-up spawns when seated
    const minAngleDiff = (35 * Math.PI) / 180;
    let theta = Math.random() * Math.PI * 2;

    for (let attempt = 0; attempt < 12; attempt++) {
      theta = Math.random() * Math.PI * 2;

      // Avoid consecutive entry angle repetition
      if (this.lastTheta >= 0) {
        let diff = Math.abs(theta - this.lastTheta);
        diff = Math.min(diff, Math.PI * 2 - diff);
        if (diff < minAngleDiff) continue;
      }

      // When seated, avoid entry from bottom edge (traveling upwards from floor)
      // Since travel direction is (cos theta, sin theta), entry ray is (-cos theta, -sin theta).
      // Entry Y is bottom edge when -sin(theta) > 0.3 (i.e. sin(theta) < -0.3)
      if (isSeated && Math.sin(theta) < -0.3) {
        continue;
      }

      break;
    }
    this.lastTheta = theta;

    // 3. Ray-cast to find entry point (spawnX, spawnY) along (-cos(theta), -sin(theta))
    const entryDirX = -Math.cos(theta);
    const entryDirY = -Math.sin(theta);
    const spawn = this.rayBoxIntersection(anchorX, anchorY, entryDirX, entryDirY, 0.08);

    // 4. Ray-cast to find exit point (exitX, exitY) along (+cos(theta), +sin(theta))
    const exitDirX = Math.cos(theta);
    const exitDirY = Math.sin(theta);
    const exit = this.rayBoxIntersection(anchorX, anchorY, exitDirX, exitDirY, 0.08);

    // Normalized travel velocity vector
    const dist = Math.hypot(exit.x - spawn.x, exit.y - spawn.y);
    const vx = dist > 0.0001 ? (exit.x - spawn.x) / dist : exitDirX;
    const vy = dist > 0.0001 ? (exit.y - spawn.y) / dist : exitDirY;

    // Optional slight perpendicular curve for visual variety (quadratic arc)
    const arcOffset = (Math.random() - 0.5) * 0.08;
    const telegraphDuration = 450; // 450ms edge warning

    return {
      anchorPos: { x: anchorX, y: anchorY },
      spawnX: spawn.x,
      spawnY: spawn.y,
      exitX: exit.x,
      exitY: exit.y,
      vx,
      vy,
      arcOffset,
      telegraphDuration,
    };
  }

  public createPulseOrb(
    calibration: CalibrationData,
    difficultyMultiplier: number = 1.0,
    difficultyLevel: DifficultyLevel = 'medium'
  ): PulseOrbTarget {
    const traj = this.createCrossScreenTrajectory(calibration, calibration.posture);

    // Crossing duration over 1.6s - 2.2s (tightening gradually as difficulty ramps)
    const baseDuration = difficultyLevel === 'easy' ? 2200 : difficultyLevel === 'hard' ? 1650 : 1900;
    const minDuration = difficultyLevel === 'easy' ? 1700 : difficultyLevel === 'hard' ? 1200 : 1450;
    const rampFactor = difficultyLevel === 'easy' ? 0.2 : difficultyLevel === 'hard' ? 0.35 : 0.28;
    const duration = Math.max(minDuration, baseDuration / (1 + (difficultyMultiplier - 1) * rampFactor));

    // Left vs Right hand color cues based on target anchor side
    const side = traj.anchorPos.x >= (calibration.shoulderCenter?.x ?? 0.5) ? 1 : -1;
    const color = side > 0 ? '#ff007f' : '#00f3ff';

    return {
      id: this.nextId('orb'),
      kind: 'pulse_orb',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      targetPos: traj.anchorPos,
      originPos: { x: traj.spawnX, y: traj.spawnY },
      currentPos: { x: traj.spawnX, y: traj.spawnY },
      scale: 1.0, // Full size throughout cross-screen journey
      timingRingScale: 1.0,
      duration,
      radius: difficultyLevel === 'easy' ? 50 : 46,
      color,
      isHit: false,
      powerHit: false,
      missed: false,

      // Cross-screen trajectory fields
      spawnX: traj.spawnX,
      spawnY: traj.spawnY,
      exitX: traj.exitX,
      exitY: traj.exitY,
      vx: traj.vx,
      vy: traj.vy,
      telegraphRemaining: traj.telegraphDuration,
      telegraphDuration: traj.telegraphDuration,
      arcOffset: traj.arcOffset,
      escaped: false,
      progress: 0,
    };
  }

  public createSolarNode(
    calibration: CalibrationData,
    difficultyLevel: DifficultyLevel = 'medium'
  ): SolarNodeTarget {
    const traj = this.createCrossScreenTrajectory(calibration, calibration.posture);

    // Volt Nodes cross ~45% slower (3.4s - 4.2s) to allow tracking and holding
    const crossingTime = difficultyLevel === 'easy' ? 4200 : difficultyLevel === 'hard' ? 3400 : 3800;
    const holdDurationRequired = difficultyLevel === 'easy' ? 450 : difficultyLevel === 'hard' ? 700 : 600;

    return {
      id: this.nextId('solar'),
      kind: 'solar_node',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      centerPos: traj.anchorPos,
      currentPos: { x: traj.spawnX, y: traj.spawnY },
      amplitude: 0.03 + Math.random() * 0.02,
      frequency: 1.2 + Math.random() * 0.8,
      holdDurationRequired,
      currentHoldTime: 0,
      radius: difficultyLevel === 'easy' ? 58 : 54,
      activeHand: null,
      isCompleted: false,
      lifetime: crossingTime,
      missed: false,

      // Cross-screen trajectory fields
      spawnX: traj.spawnX,
      spawnY: traj.spawnY,
      exitX: traj.exitX,
      exitY: traj.exitY,
      vx: traj.vx,
      vy: traj.vy,
      telegraphRemaining: traj.telegraphDuration,
      telegraphDuration: traj.telegraphDuration,
      arcOffset: traj.arcOffset,
      escaped: false,
      progress: 0,
    };
  }

  public createLaserBarrier(
    calibration: CalibrationData,
    difficultyLevel: DifficultyLevel = 'medium'
  ): LaserBarrierTarget {
    const isStanding = calibration.posture === 'standing';
    const orientations: ('horizontal_squat' | 'vertical_left' | 'vertical_right')[] = isStanding
      ? ['horizontal_squat', 'vertical_left', 'vertical_right']
      : ['vertical_left', 'vertical_right'];

    const chosen = orientations[Math.floor(Math.random() * orientations.length)];

    const warningDuration = difficultyLevel === 'easy' ? 1900 : difficultyLevel === 'hard' ? 1150 : 1500;
    const activeDuration = difficultyLevel === 'easy' ? 750 : difficultyLevel === 'hard' ? 950 : 850;

    return {
      id: this.nextId('laser'),
      kind: 'laser_barrier',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      orientation: chosen,
      warningDuration,
      activeDuration,
      isDodged: false,
      hasCollided: false,
      damageApplied: false,
    };
  }
}
