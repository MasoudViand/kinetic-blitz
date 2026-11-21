import { Point2D, CalibrationData, PulseOrbTarget, SolarNodeTarget, LaserBarrierTarget } from '../types/game';
import { GAME_TUNING } from './tuning';

interface WristHistory {
  pos: Point2D;
  time: number;
}

export interface HitResult {
  orb: PulseOrbTarget;
  isPower: boolean;
  isDirectionalCounter?: boolean;
  hand: 'left' | 'right';
  screenPos: Point2D;
}

export interface DodgeResult {
  barrier: LaserBarrierTarget;
  success: boolean;
}

export class CollisionDetector {
  private leftWristHistory: WristHistory[] = [];
  private rightWristHistory: WristHistory[] = [];
  private readonly historyWindowMs = 120; // 120ms window for velocity calculation

  public updateWristPositions(
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    now: number = performance.now()
  ) {
    if (leftWrist) {
      this.leftWristHistory.push({ pos: { ...leftWrist }, time: now });
      this.pruneHistory(this.leftWristHistory, now);
    } else {
      this.leftWristHistory = [];
    }

    if (rightWrist) {
      this.rightWristHistory.push({ pos: { ...rightWrist }, time: now });
      this.pruneHistory(this.rightWristHistory, now);
    } else {
      this.rightWristHistory = [];
    }
  }

  private pruneHistory(history: WristHistory[], now: number) {
    while (history.length > 0 && now - history[0].time > this.historyWindowMs) {
      history.shift();
    }
  }

  public getWristVelocity(hand: 'left' | 'right'): number {
    return this.getWristVelocityVector(hand).speed;
  }

  public getWristVelocityVector(hand: 'left' | 'right'): { speed: number; vx: number; vy: number } {
    const history = hand === 'left' ? this.leftWristHistory : this.rightWristHistory;
    if (history.length < 2) return { speed: 0, vx: 0, vy: 0 };

    const oldest = history[0];
    const newest = history[history.length - 1];
    const dt = (newest.time - oldest.time) / 1000;
    if (dt <= 0.001) return { speed: 0, vx: 0, vy: 0 };

    const dx = newest.pos.x - oldest.pos.x;
    const dy = newest.pos.y - oldest.pos.y;
    const dist = Math.hypot(dx, dy);

    return {
      speed: dist / dt,
      vx: dist > 0.0001 ? dx / dist : 0,
      vy: dist > 0.0001 ? dy / dist : 0,
    };
  }

  public checkPulseOrbCollision(
    orb: PulseOrbTarget,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    canvasWidth: number,
    canvasHeight: number,
    isTutorial: boolean = false
  ): HitResult | null {
    if (orb.isHit || orb.missed || orb.escaped) return null;

    // While telegraphing at the edge before entering playfield, orb cannot be hit yet
    if (orb.telegraphRemaining > 0) return null;

    const orbPixelX = orb.currentPos.x * canvasWidth;
    const orbPixelY = orb.currentPos.y * canvasHeight;
    const radiusMult = (isTutorial ? 1.45 : 1.25) * GAME_TUNING.ORB_HITBOX_MULTIPLIER;
    const hitRadius = orb.radius * radiusMult; // Generous strike forgiveness from GAME_TUNING

    // Cannot hit an orb that has already fully exited the screen bounds
    if (
      orbPixelX + hitRadius < -20 ||
      orbPixelX - hitRadius > canvasWidth + 20 ||
      orbPixelY + hitRadius < -20 ||
      orbPixelY - hitRadius > canvasHeight + 20
    ) {
      return null;
    }

    // Check both hands
    const hands: { name: 'left' | 'right'; pt: Point2D | null }[] = [
      { name: 'left', pt: leftWrist },
      { name: 'right', pt: rightWrist },
    ];

    for (const h of hands) {
      if (!h.pt) continue;

      // Color-matching rule:
      // Left hand (Cyan reticle #00f3ff) can ONLY hit Cyan orbs (#00f3ff)
      // Right hand (Magenta reticle #ff007f) can ONLY hit Magenta orbs (#ff007f)
      const orbColor = orb.color.toLowerCase();
      const isMatchingHand =
        (h.name === 'left' && (orbColor === '#00f3ff' || orbColor.includes('cyan') || orbColor === '#38bdf8')) ||
        (h.name === 'right' && (orbColor === '#ff007f' || orbColor.includes('magenta') || orbColor === '#f43f5e'));

      if (!isMatchingHand) {
        continue;
      }

      const wristPixelX = h.pt.x * canvasWidth;
      const wristPixelY = h.pt.y * canvasHeight;

      const dx = wristPixelX - orbPixelX;
      const dy = wristPixelY - orbPixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= hitRadius) {
        const motion = this.getWristVelocityVector(h.name);
        const isSpeedPower = motion.speed > 1.1;

        // Directional counter strike: hand moving against the orb's velocity vector
        // Dot product < -0.15 indicates striking directly into incoming trajectory
        const dot = motion.vx * orb.vx + motion.vy * orb.vy;
        const isDirectionalCounter = dot < -0.15;
        const isPower = isSpeedPower || (motion.speed > 0.85 && isDirectionalCounter);

        orb.isHit = true;
        orb.powerHit = isPower;

        return {
          orb,
          isPower,
          isDirectionalCounter,
          hand: h.name,
          screenPos: { x: orbPixelX, y: orbPixelY },
        };
      }
    }

    return null;
  }

  public checkSolarNodeHold(
    node: SolarNodeTarget,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    dtMs: number,
    canvasWidth: number,
    canvasHeight: number
  ): { isCompleted: boolean; progress: number; handInNode: 'left' | 'right' | null } {
    if (node.isCompleted || node.missed || node.escaped) {
      node.isHeld = false;
      node.heldHandPos = null;
      return { isCompleted: false, progress: 0, handInNode: null };
    }

    // While telegraphing at the edge, node is not in play yet
    if (node.telegraphRemaining > 0) {
      node.isHeld = false;
      node.heldHandPos = null;
      return { isCompleted: false, progress: 0, handInNode: null };
    }

    const nodePixelX = node.currentPos.x * canvasWidth;
    const nodePixelY = node.currentPos.y * canvasHeight;

    // Sticky Lock-On (Hysteresis):
    // If not currently held: must enter within VOLT_GRAB_RADIUS_MULT (1.35x)
    // If already held: wider sticky radius VOLT_MAINTAIN_RADIUS_MULT (1.85x) to absorb pose jitter
    const grabRadius = node.radius * GAME_TUNING.VOLT_GRAB_RADIUS_MULT;
    const maintainRadius = node.radius * GAME_TUNING.VOLT_MAINTAIN_RADIUS_MULT;
    const activeRadius = node.isHeld ? maintainRadius : grabRadius;

    let handInside: 'left' | 'right' | null = null;
    let grabbingHandPos: Point2D | null = null;

    const hands: { name: 'left' | 'right'; pt: Point2D | null }[] = [
      { name: 'left', pt: leftWrist },
      { name: 'right', pt: rightWrist },
    ];

    for (const h of hands) {
      if (!h.pt) continue;
      const wx = h.pt.x * canvasWidth;
      const wy = h.pt.y * canvasHeight;
      const dist = Math.hypot(wx - nodePixelX, wy - nodePixelY);

      if (dist <= activeRadius) {
        handInside = h.name;
        grabbingHandPos = h.pt;
        break;
      }
    }

    if (handInside && grabbingHandPos) {
      node.isHeld = true;
      node.activeHand = handInside;
      node.heldHandPos = { x: grabbingHandPos.x, y: grabbingHandPos.y };
      node.currentHoldTime += dtMs;

      if (node.currentHoldTime >= node.holdDurationRequired) {
        node.isCompleted = true;
        return { isCompleted: true, progress: 1.0, handInNode: handInside };
      }
    } else {
      node.isHeld = false;
      node.activeHand = null;
      node.heldHandPos = null;
      // Smooth decay at half-speed instead of resetting to 0
      node.currentHoldTime = Math.max(0, node.currentHoldTime - dtMs * GAME_TUNING.VOLT_CHARGE_DECAY_RATE);
    }

    const progress = Math.min(1.0, node.currentHoldTime / node.holdDurationRequired);
    return { isCompleted: false, progress, handInNode: handInside };
  }

  public checkLaserBarrier(
    barrier: LaserBarrierTarget,
    now: number,
    nose: Point2D | null,
    shoulderCenter: Point2D | null,
    calibration: CalibrationData
  ): { isActive: boolean; isFinished: boolean; warningAlpha: number; collisionNow: boolean; dodgedNow: boolean } {
    const elapsed = now - barrier.spawnTime;
    const isWarning = elapsed < barrier.warningDuration;
    const isActive = elapsed >= barrier.warningDuration && elapsed < barrier.warningDuration + barrier.activeDuration;
    const isFinished = elapsed >= barrier.warningDuration + barrier.activeDuration;

    if (isWarning) {
      const warningAlpha = (Math.sin(elapsed / 120 * Math.PI) + 1) / 2; // Pulsing 0..1
      return { isActive: false, isFinished: false, warningAlpha, collisionNow: false, dodgedNow: false };
    }

    if (!isActive && !isFinished) {
      return { isActive: false, isFinished: false, warningAlpha: 0, collisionNow: false, dodgedNow: false };
    }

    let collisionNow = false;

    if (isActive && !barrier.damageApplied) {
      // Evaluate collision based on orientation and player body position
      if (barrier.orientation === 'horizontal_squat') {
        // Safe line is squat depth: head/nose must duck below calibrated baseline
        const squatThresholdY = calibration.headY + 0.12;
        const currentHeadY = nose ? nose.y : (shoulderCenter ? shoulderCenter.y - 0.1 : 0.5);

        // If player's head is higher than squat threshold (i.e. did not squat down)
        if (currentHeadY < squatThresholdY) {
          collisionNow = true;
          barrier.hasCollided = true;
          barrier.damageApplied = true;
        }
      } else if (barrier.orientation === 'vertical_left') {
        // Beam covers left half of play area: player must lean right
        const currentTorsoX = shoulderCenter ? shoulderCenter.x : (nose ? nose.x : 0.5);
        if (currentTorsoX < 0.5) {
          collisionNow = true;
          barrier.hasCollided = true;
          barrier.damageApplied = true;
        }
      } else if (barrier.orientation === 'vertical_right') {
        // Beam covers right half of play area: player must lean left
        const currentTorsoX = shoulderCenter ? shoulderCenter.x : (nose ? nose.x : 0.5);
        if (currentTorsoX > 0.5) {
          collisionNow = true;
          barrier.hasCollided = true;
          barrier.damageApplied = true;
        }
      }
    }

    let dodgedNow = false;
    if (isFinished && !barrier.isDodged) {
      if (!barrier.hasCollided) {
        barrier.isDodged = true;
        dodgedNow = true;
      }
    }

    return {
      isActive,
      isFinished,
      warningAlpha: isActive ? 1.0 : 0,
      collisionNow,
      dodgedNow,
    };
  }
}
