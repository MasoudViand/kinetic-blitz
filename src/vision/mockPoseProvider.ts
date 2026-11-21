import { Landmark3D, PostureType, Point2D } from '../types/game';
import { GameEngine } from '../engine/gameEngine';

export class MockPoseProvider {
  public enabled: boolean = false;
  public isForced: boolean = false;
  public simulatedPosture: PostureType = 'standing';
  public isPresent: boolean = true;
  public isBotActive: boolean = true;
  private gameEngine: GameEngine | null = null;

  public setGameEngine(engine: GameEngine) {
    this.gameEngine = engine;
  }

  // Real-time animation states
  private leftHandTarget: Point2D = { x: 0.38, y: 0.5 };
  private rightHandTarget: Point2D = { x: 0.62, y: 0.5 };
  private leftHandCurrent: Point2D = { x: 0.38, y: 0.5 };
  private rightHandCurrent: Point2D = { x: 0.62, y: 0.5 };
  private headOffset: Point2D = { x: 0, y: 0 };
  private torsoOffset: Point2D = { x: 0, y: 0 };

  constructor() {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mock') === 'true') {
        this.enabled = true;
        this.isForced = true;
      }
    }
  }

  public triggerPunch(hand: 'left' | 'right', targetX: number = 0.5, targetY: number = 0.4) {
    if (hand === 'left') {
      this.leftHandCurrent = { x: targetX, y: targetY };
      this.leftHandTarget = { x: targetX, y: targetY };
      setTimeout(() => {
        this.leftHandTarget = { x: 0.38, y: 0.5 };
      }, 250);
    } else {
      this.rightHandCurrent = { x: targetX, y: targetY };
      this.rightHandTarget = { x: targetX, y: targetY };
      setTimeout(() => {
        this.rightHandTarget = { x: 0.62, y: 0.5 };
      }, 250);
    }
  }

  public triggerSquat(durationMs: number = 900) {
    this.headOffset.y = 0.22; // Squat down
    this.torsoOffset.y = 0.18;
    setTimeout(() => {
      this.headOffset.y = 0;
      this.torsoOffset.y = 0;
    }, durationMs);
  }

  public triggerLean(direction: 'left' | 'right', durationMs: number = 1000) {
    const shift = direction === 'left' ? -0.16 : 0.16;
    this.headOffset.x = shift;
    this.torsoOffset.x = shift;
    setTimeout(() => {
      this.headOffset.x = 0;
      this.torsoOffset.x = 0;
    }, durationMs);
  }

  public generateLandmarks(gameEngine?: GameEngine): Landmark3D[] | null {
    if (!this.isPresent) {
      return null;
    }

    const now = performance.now();
    const timeSec = now / 1000;
    const engine = gameEngine || this.gameEngine;

    // Autonomous Bot logic: automatically play the game smoothly if bot active
    if (this.isBotActive && engine && (engine.state === 'playing' || engine.state === 'tutorial')) {
      this.runBotLogic(engine, now);
    }

    // Smooth hand lerp toward targets
    const lerpSpeed = 0.25;
    this.leftHandCurrent.x += (this.leftHandTarget.x - this.leftHandCurrent.x) * lerpSpeed;
    this.leftHandCurrent.y += (this.leftHandTarget.y - this.leftHandCurrent.y) * lerpSpeed;
    this.rightHandCurrent.x += (this.rightHandTarget.x - this.rightHandCurrent.x) * lerpSpeed;
    this.rightHandCurrent.y += (this.rightHandTarget.y - this.rightHandCurrent.y) * lerpSpeed;

    // Natural breathing / idle body sway
    const swayX = Math.sin(timeSec * 1.5) * 0.005;
    const swayY = Math.cos(timeSec * 2.0) * 0.003;

    const isStanding = this.simulatedPosture === 'standing';
    const centerX = 0.5 + this.torsoOffset.x + swayX;
    const shoulderY = (isStanding ? 0.38 : 0.44) + this.torsoOffset.y + swayY;
    const sw = isStanding ? 0.22 : 0.20; // Shoulder width

    const noseX = centerX + this.headOffset.x;
    const noseY = (isStanding ? 0.24 : 0.30) + this.headOffset.y + swayY;

    // 33 standard MediaPipe pose landmarks
    const landmarks: Landmark3D[] = new Array(33);

    // 0: Nose
    landmarks[0] = { x: noseX, y: noseY, z: -0.1, visibility: 0.99 };

    // 1-10: Face landmarks
    for (let i = 1; i <= 10; i++) {
      landmarks[i] = { x: noseX + (i % 2 === 0 ? 0.02 : -0.02), y: noseY, z: -0.1, visibility: 0.95 };
    }

    // 11: Left Shoulder, 12: Right Shoulder (MediaPipe: left is user's left, in mirrored view x < 0.5)
    landmarks[11] = { x: centerX - sw / 2, y: shoulderY, z: 0.0, visibility: 0.98 };
    landmarks[12] = { x: centerX + sw / 2, y: shoulderY, z: 0.0, visibility: 0.98 };

    // 13: Left Elbow, 14: Right Elbow
    landmarks[13] = { x: centerX - sw * 0.7, y: shoulderY + 0.14, z: 0.05, visibility: 0.95 };
    landmarks[14] = { x: centerX + sw * 0.7, y: shoulderY + 0.14, z: 0.05, visibility: 0.95 };

    // 15: Left Wrist, 16: Right Wrist
    landmarks[15] = { x: this.leftHandCurrent.x, y: this.leftHandCurrent.y, z: -0.05, visibility: 0.99 };
    landmarks[16] = { x: this.rightHandCurrent.x, y: this.rightHandCurrent.y, z: -0.05, visibility: 0.99 };

    // 17-22: Hands & fingers (aligned with hand center)
    for (let i = 17; i <= 22; i++) {
      const isLeft = i % 2 !== 0;
      const refWrist = isLeft ? landmarks[15] : landmarks[16];
      landmarks[i] = { x: refWrist.x, y: refWrist.y, z: refWrist.z, visibility: 0.95 };
    }

    // 23: Left Hip, 24: Right Hip
    const hipY = shoulderY + (isStanding ? 0.32 : 0.28);
    const hw = sw * 0.75;
    landmarks[23] = { x: centerX - hw / 2, y: hipY, z: 0.0, visibility: isStanding ? 0.92 : 0.3 };
    landmarks[24] = { x: centerX + hw / 2, y: hipY, z: 0.0, visibility: isStanding ? 0.92 : 0.3 };

    // 25: Left Knee, 26: Right Knee
    const kneeY = hipY + (isStanding ? 0.22 : 0.05); // Vertically separated when standing, horizontally aligned when seated
    landmarks[25] = { x: centerX - hw / 2, y: kneeY, z: 0.0, visibility: isStanding ? 0.9 : 0.2 };
    landmarks[26] = { x: centerX + hw / 2, y: kneeY, z: 0.0, visibility: isStanding ? 0.9 : 0.2 };

    // 27-32: Ankles and feet
    for (let i = 27; i <= 32; i++) {
      landmarks[i] = {
        x: centerX + (i % 2 === 0 ? 0.08 : -0.08),
        y: Math.min(0.98, kneeY + 0.2),
        z: 0.0,
        visibility: isStanding ? 0.85 : 0.1,
      };
    }

    return landmarks;
  }

  private runBotLogic(game: GameEngine, now: number) {
    // 1. Check incoming Pulse Orbs: hit once telegraph ends and target passes into reachable screen zone
    for (const orb of game.pulseOrbs) {
      if (orb.isHit || orb.missed || orb.escaped) continue;
      if (orb.telegraphRemaining === 0 && orb.progress >= 0.30 && orb.progress <= 0.85) {
        // Strike with the hand matching the orb's color: Cyan (#00f3ff) = Left, Magenta (#ff007f) = Right
        const isRight = orb.color.toLowerCase() === '#ff007f' || orb.color.toLowerCase().includes('magenta');
        this.triggerPunch(isRight ? 'right' : 'left', orb.currentPos.x, orb.currentPos.y);
        break;
      }
    }

    // 2. Check Solar Nodes: move closest hand to track and hold
    if (game.solarNodes.length > 0) {
      const node = game.solarNodes[0];
      if (!node.isCompleted && !node.missed && !node.escaped && node.telegraphRemaining === 0) {
        const isLeft = node.currentPos.x <= 0.5;
        if (isLeft) {
          this.leftHandTarget = { x: node.currentPos.x, y: node.currentPos.y };
        } else {
          this.rightHandTarget = { x: node.currentPos.x, y: node.currentPos.y };
        }
      }
    }

    // 3. Check Laser Barriers: react to telegraph warning
    for (const barrier of game.laserBarriers) {
      const elapsed = now - barrier.spawnTime;
      // React during warning and active phases
      if (elapsed > 800 && elapsed < barrier.warningDuration + barrier.activeDuration) {
        if (barrier.orientation === 'horizontal_squat') {
          this.headOffset.y = 0.22;
          this.torsoOffset.y = 0.18;
        } else if (barrier.orientation === 'vertical_left') {
          this.headOffset.x = 0.18; // Lean right
          this.torsoOffset.x = 0.18;
        } else if (barrier.orientation === 'vertical_right') {
          this.headOffset.x = -0.18; // Lean left
          this.torsoOffset.x = -0.18;
        }
      } else {
        // Return to normal posture
        this.headOffset.x = 0;
        this.headOffset.y = 0;
        this.torsoOffset.x = 0;
        this.torsoOffset.y = 0;
      }
    }
  }
}

export const mockPoseProvider = new MockPoseProvider();
