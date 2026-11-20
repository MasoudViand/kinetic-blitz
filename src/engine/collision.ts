import { Point2D, CalibrationData, PulseOrbTarget, SolarNodeTarget, LaserBarrierTarget } from '../types/game';

interface WristHistory {
  pos: Point2D;
  time: number;
}

export interface HitResult {
  orb: PulseOrbTarget;
  isPower: boolean;
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
    const history = hand === 'left' ? this.leftWristHistory : this.rightWristHistory;
    if (history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];
    const dt = (newest.time - oldest.time) / 1000;
    if (dt <= 0.001) return 0;

    const dx = newest.pos.x - oldest.pos.x;
    const dy = newest.pos.y - oldest.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist / dt; // Normalized units per second
  }

  public checkPulseOrbCollision(
    orb: PulseOrbTarget,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    canvasWidth: number,
    canvasHeight: number,
    isTutorial: boolean = false
  ): HitResult | null {
    if (orb.isHit || orb.missed) return null;

    // Check hit window:
    // Minimum scale required before an orb can be struck (avoid hitting far background spawns)
    // Players can hit orbs continuously until they leave the screen!
    const minScale = isTutorial ? 0.45 : 0.55;
    if (orb.scale < minScale) return null;

    const orbPixelX = orb.currentPos.x * canvasWidth;
    const orbPixelY = orb.currentPos.y * canvasHeight;
    const radiusMult = isTutorial ? 1.45 : 1.22;
    const hitRadius = orb.radius * Math.max(1.0, orb.scale) * radiusMult; // Generous hit registration

    // Cannot hit an orb that has already fully exited the screen
    if (
      orbPixelX + hitRadius < 0 ||
      orbPixelX - hitRadius > canvasWidth ||
      orbPixelY + hitRadius < 0 ||
      orbPixelY - hitRadius > canvasHeight
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
      const wristPixelX = h.pt.x * canvasWidth;
      const wristPixelY = h.pt.y * canvasHeight;

      const dx = wristPixelX - orbPixelX;
      const dy = wristPixelY - orbPixelY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= hitRadius) {
        const vel = this.getWristVelocity(h.name);
        const isPower = vel > 1.2; // Power hit threshold (fast snap)

        orb.isHit = true;
        orb.powerHit = isPower;

        return {
          orb,
          isPower,
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
    if (node.isCompleted || node.missed) {
      return { isCompleted: false, progress: 0, handInNode: null };
    }

    const nodePixelX = node.currentPos.x * canvasWidth;
    const nodePixelY = node.currentPos.y * canvasHeight;
    const holdRadius = node.radius * 1.25;

    let handInside: 'left' | 'right' | null = null;

    const checkHand = (pt: Point2D | null) => {
      if (!pt) return false;
      const wx = pt.x * canvasWidth;
      const wy = pt.y * canvasHeight;
      const dx = wx - nodePixelX;
      const dy = wy - nodePixelY;
      return Math.sqrt(dx * dx + dy * dy) <= holdRadius;
    };

    if (checkHand(leftWrist)) {
      handInside = 'left';
    } else if (checkHand(rightWrist)) {
      handInside = 'right';
    }

    node.activeHand = handInside;

    if (handInside) {
      node.currentHoldTime += dtMs;
      if (node.currentHoldTime >= node.holdDurationRequired) {
        node.isCompleted = true;
        return { isCompleted: true, progress: 1.0, handInNode: handInside };
      }
    } else {
      // Gentle decay if hand slips out
      node.currentHoldTime = Math.max(0, node.currentHoldTime - dtMs * 1.2);
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
