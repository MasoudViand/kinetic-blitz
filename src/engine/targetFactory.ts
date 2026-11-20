import { CalibrationData, PulseOrbTarget, SolarNodeTarget, LaserBarrierTarget, Point2D, DifficultyLevel } from '../types/game';

export class TargetFactory {
  private idCounter = 0;

  private nextId(prefix: string): string {
    return `${prefix}_${++this.idCounter}_${Date.now()}`;
  }

  public createPulseOrb(
    calibration: CalibrationData,
    difficultyMultiplier: number = 1.0,
    difficultyLevel: DifficultyLevel = 'medium'
  ): PulseOrbTarget {
    const isStanding = calibration.posture === 'standing';
    const center = calibration.shoulderCenter;
    const sw = calibration.shoulderWidth;

    // Origin: near central torso / horizon
    const originPos: Point2D = {
      x: center.x + (Math.random() * 0.1 - 0.05),
      y: center.y + 0.05,
    };

    // Landing target position scaled relative to user's shoulder width
    const minReach = isStanding ? 0.9 : 0.7;
    const maxReach = isStanding ? 2.1 : 1.6;
    const side = Math.random() > 0.5 ? 1 : -1;
    const reachFactor = minReach + Math.random() * (maxReach - minReach);

    let targetX = center.x + side * (reachFactor * sw);
    targetX = Math.max(0.12, Math.min(0.88, targetX));

    // Vertical variation: upper punch, eye-level jab, or lower body hook
    const verticalOptions = isStanding 
      ? [-0.25, -0.1, 0.05, 0.2] // relative to shoulderCenter.y
      : [-0.2, -0.05, 0.1];
    const verticalOffset = verticalOptions[Math.floor(Math.random() * verticalOptions.length)];
    let targetY = center.y + verticalOffset;
    targetY = Math.max(0.15, Math.min(0.82, targetY));

    // Base duration scales by selected difficulty level
    const baseDuration = difficultyLevel === 'easy' ? 2000 : difficultyLevel === 'hard' ? 1200 : 1600;
    const minDuration = difficultyLevel === 'easy' ? 1350 : difficultyLevel === 'hard' ? 750 : 1050;
    const rampFactor = difficultyLevel === 'easy' ? 0.25 : difficultyLevel === 'hard' ? 0.45 : 0.35;
    const duration = Math.max(minDuration, baseDuration / (1 + (difficultyMultiplier - 1) * rampFactor));

    // Left vs Right hand coloring cues (Cyan for left/neutral, Magenta for right)
    const color = side > 0 ? '#ff007f' : '#00f3ff';

    return {
      id: this.nextId('orb'),
      kind: 'pulse_orb',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      targetPos: { x: targetX, y: targetY },
      originPos,
      currentPos: { ...originPos },
      scale: 0.2,
      timingRingScale: difficultyLevel === 'easy' ? 2.4 : 2.2,
      duration,
      radius: difficultyLevel === 'easy' ? 50 : 46,
      color,
      isHit: false,
      powerHit: false,
      missed: false,
    };
  }

  public createSolarNode(
    calibration: CalibrationData,
    difficultyLevel: DifficultyLevel = 'medium'
  ): SolarNodeTarget {
    const isStanding = calibration.posture === 'standing';
    const center = calibration.shoulderCenter;
    const sw = calibration.shoulderWidth;

    // Placed along upper mobility arc (overhead or lateral reach)
    const side = Math.random() > 0.5 ? 1 : -1;
    const reachFactor = isStanding ? 1.4 + Math.random() * 0.8 : 1.1 + Math.random() * 0.5;

    let targetX = center.x + side * (reachFactor * sw);
    targetX = Math.max(0.15, Math.min(0.85, targetX));

    // High overhead or upper shoulder
    const targetY = Math.max(0.12, center.y - (isStanding ? 0.25 : 0.2) - Math.random() * 0.1);

    const holdDurationRequired = difficultyLevel === 'easy' ? 450 : difficultyLevel === 'hard' ? 700 : 600;
    const lifetime = difficultyLevel === 'easy' ? 6500 : difficultyLevel === 'hard' ? 4500 : 5500;

    return {
      id: this.nextId('solar'),
      kind: 'solar_node',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      centerPos: { x: targetX, y: targetY },
      currentPos: { x: targetX, y: targetY },
      amplitude: 0.02 + Math.random() * 0.02,
      frequency: 1.5 + Math.random() * 1.5,
      holdDurationRequired,
      currentHoldTime: 0,
      radius: difficultyLevel === 'easy' ? 58 : 54,
      activeHand: null,
      isCompleted: false,
      lifetime,
      missed: false,
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
