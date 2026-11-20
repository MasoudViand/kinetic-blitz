import { CalibrationData, PulseOrbTarget, SolarNodeTarget, LaserBarrierTarget, Point2D } from '../types/game';

export class TargetFactory {
  private idCounter = 0;

  private nextId(prefix: string): string {
    return `${prefix}_${++this.idCounter}_${Date.now()}`;
  }

  public createPulseOrb(calibration: CalibrationData, difficultyMultiplier: number = 1.0): PulseOrbTarget {
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

    // Duration scales down with difficulty (1600ms down to 1050ms)
    const duration = Math.max(1050, 1600 / (1 + (difficultyMultiplier - 1) * 0.35));

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
      timingRingScale: 2.2,
      duration,
      radius: 46,
      color,
      isHit: false,
      powerHit: false,
      missed: false,
    };
  }

  public createSolarNode(calibration: CalibrationData): SolarNodeTarget {
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

    return {
      id: this.nextId('solar'),
      kind: 'solar_node',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      centerPos: { x: targetX, y: targetY },
      currentPos: { x: targetX, y: targetY },
      amplitude: 0.02 + Math.random() * 0.02,
      frequency: 1.5 + Math.random() * 1.5,
      holdDurationRequired: 600, // 600ms hold
      currentHoldTime: 0,
      radius: 54,
      activeHand: null,
      isCompleted: false,
      lifetime: 5500, // 5.5s to reach and hold
      missed: false,
    };
  }

  public createLaserBarrier(calibration: CalibrationData): LaserBarrierTarget {
    const isStanding = calibration.posture === 'standing';
    const orientations: ('horizontal_squat' | 'vertical_left' | 'vertical_right')[] = isStanding
      ? ['horizontal_squat', 'vertical_left', 'vertical_right']
      : ['vertical_left', 'vertical_right'];

    const chosen = orientations[Math.floor(Math.random() * orientations.length)];

    return {
      id: this.nextId('laser'),
      kind: 'laser_barrier',
      createdAt: performance.now(),
      spawnTime: performance.now(),
      orientation: chosen,
      warningDuration: 1500, // 1.5s telegraph warning
      activeDuration: 850,   // 850ms dangerous active beam
      isDodged: false,
      hasCollided: false,
      damageApplied: false,
    };
  }
}
