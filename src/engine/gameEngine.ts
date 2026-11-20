import {
  GameMode,
  GameState,
  CalibrationData,
  PulseOrbTarget,
  SolarNodeTarget,
  LaserBarrierTarget,
  PlayerStats,
  Point2D,
} from '../types/game';
import { TargetFactory } from './targetFactory';
import { CollisionDetector } from './collision';
import { ParticleSystem } from './particleSystem';
import { soundEngine } from '../audio/soundEngine';

export class GameEngine {
  public state: GameState = 'idle';
  public mode: GameMode = 'quick';
  public timeRemaining: number = 60; // In seconds
  public durationTotal: number = 60;
  public screenShake: number = 0;

  public pulseOrbs: PulseOrbTarget[] = [];
  public solarNodes: SolarNodeTarget[] = [];
  public laserBarriers: LaserBarrierTarget[] = [];

  public stats: PlayerStats = {
    score: 0,
    combo: 1,
    maxCombo: 1,
    pulseHits: 0,
    powerHits: 0,
    solarHolds: 0,
    lasersDodged: 0,
    lasersHit: 0,
    caloriesBurned: 0,
    totalStrikesAttempted: 0,
  };

  public calibration: CalibrationData = {
    shoulderCenter: { x: 0.5, y: 0.4 },
    shoulderWidth: 0.25,
    torsoHeight: 0.35,
    headY: 0.25,
    reachRadiusX: 0.35,
    reachRadiusY: 0.3,
    posture: 'standing',
    calibratedAt: 0,
  };

  private targetFactory = new TargetFactory();
  public collision = new CollisionDetector();
  public particles = new ParticleSystem();

  private lastSpawnOrbTime = 0;
  private lastSpawnSolarTime = 0;
  private lastSpawnLaserTime = 0;
  private difficultyMultiplier = 1.0;
  private gameStartTime = 0;
  private lastUpdateTime = 0;

  public onStateChange?: (state: GameState) => void;
  public onStatsUpdate?: (stats: PlayerStats) => void;

  public startSession(mode: GameMode, calibration: CalibrationData) {
    this.mode = mode;
    this.calibration = calibration;
    this.durationTotal = mode === 'quick' ? 60 : mode === 'endurance' ? 180 : 999999;
    this.timeRemaining = this.durationTotal;

    this.resetStats();
    this.pulseOrbs = [];
    this.solarNodes = [];
    this.laserBarriers = [];
    this.particles.clear();

    this.gameStartTime = performance.now();
    this.lastUpdateTime = performance.now();
    this.lastSpawnOrbTime = performance.now() + 500; // brief pause before 1st orb
    this.lastSpawnSolarTime = performance.now() + 3000;
    this.lastSpawnLaserTime = performance.now() + 7000;

    this.state = 'playing';
    this.onStateChange?.(this.state);
    this.onStatsUpdate?.(this.stats);
  }

  public pauseSession() {
    if (this.state === 'playing') {
      this.state = 'paused';
      soundEngine.stopSolarCharge();
      this.onStateChange?.(this.state);
    }
  }

  public resumeSession() {
    if (this.state === 'paused') {
      this.lastUpdateTime = performance.now();
      this.state = 'playing';
      this.onStateChange?.(this.state);
    }
  }

  public endSession() {
    this.state = 'game_over';
    soundEngine.stopSolarCharge();
    this.saveHighScore();
    this.onStateChange?.(this.state);
    this.onStatsUpdate?.(this.stats);
  }

  private resetStats() {
    this.stats = {
      score: 0,
      combo: 1,
      maxCombo: 1,
      pulseHits: 0,
      powerHits: 0,
      solarHolds: 0,
      lasersDodged: 0,
      lasersHit: 0,
      caloriesBurned: 0,
      totalStrikesAttempted: 0,
    };
  }

  public update(
    now: number,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    nose: Point2D | null,
    shoulderCenter: Point2D | null,
    canvasWidth: number,
    canvasHeight: number
  ) {
    if (this.state !== 'playing') {
      return;
    }

    const dt = Math.min(0.1, (now - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = now;

    // Decay screen shake
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // 1. Update Game Session Timer & Difficulty Scaling
    if (this.mode !== 'endless') {
      this.timeRemaining -= dt;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.endSession();
        return;
      }
    }

    const elapsedTotal = (now - this.gameStartTime) / 1000;
    this.difficultyMultiplier = 1.0 + Math.min(1.0, elapsedTotal / 90); // Ramps over 90s

    // Calculate approximate active calorie burn (~6.5 METs shadowboxing/mobility)
    this.stats.caloriesBurned += (dt * (6.5 * 3.5 * 70) / 200 / 60);

    // 2. Collision & Motion Update
    this.collision.updateWristPositions(leftWrist, rightWrist, now);
    this.particles.recordHandPositions(
      leftWrist ? { x: leftWrist.x * canvasWidth, y: leftWrist.y * canvasHeight } : null,
      rightWrist ? { x: rightWrist.x * canvasWidth, y: rightWrist.y * canvasHeight } : null
    );
    this.particles.update(dt);

    // 3. Spawning Director
    this.spawnDirector(now);

    // 4. Update Pulse Orbs
    this.updatePulseOrbs(now, leftWrist, rightWrist, canvasWidth, canvasHeight);

    // 5. Update Solar Nodes
    this.updateSolarNodes(now, dt, leftWrist, rightWrist, canvasWidth, canvasHeight);

    // 6. Update Laser Barriers
    this.updateLaserBarriers(now, nose, shoulderCenter, canvasWidth, canvasHeight);

    this.onStatsUpdate?.(this.stats);
  }

  private spawnDirector(now: number) {
    // Pulse Orbs spawn every ~1.2s to 1.7s
    const orbInterval = Math.max(1100, 1700 - (this.difficultyMultiplier - 1) * 400);
    if (now - this.lastSpawnOrbTime > orbInterval) {
      this.pulseOrbs.push(this.targetFactory.createPulseOrb(this.calibration, this.difficultyMultiplier));
      this.lastSpawnOrbTime = now;
    }

    // Solar Nodes spawn every ~5s to 7s (max 2 simultaneously)
    const solarInterval = 5500;
    if (this.solarNodes.length < 2 && now - this.lastSpawnSolarTime > solarInterval) {
      this.solarNodes.push(this.targetFactory.createSolarNode(this.calibration));
      this.lastSpawnSolarTime = now;
    }

    // Laser Barriers spawn every ~8s to 12s (max 1 at a time)
    const laserInterval = 9000;
    if (this.laserBarriers.length === 0 && now - this.lastSpawnLaserTime > laserInterval) {
      this.laserBarriers.push(this.targetFactory.createLaserBarrier(this.calibration));
      this.lastSpawnLaserTime = now;
      soundEngine.playLaserWarning();
    }
  }

  private updatePulseOrbs(
    now: number,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    canvasWidth: number,
    canvasHeight: number
  ) {
    for (let i = this.pulseOrbs.length - 1; i >= 0; i--) {
      const orb = this.pulseOrbs[i];
      const elapsed = now - orb.spawnTime;
      const progress = elapsed / orb.duration;

      // Approaching scale from 0.2 to 1.0 along radial vector
      orb.scale = 0.2 + progress * 0.8;
      orb.timingRingScale = Math.max(1.0, 2.2 - progress * 1.2);

      // Interpolate position from origin to target
      orb.currentPos.x = orb.originPos.x + (orb.targetPos.x - orb.originPos.x) * progress;
      orb.currentPos.y = orb.originPos.y + (orb.targetPos.y - orb.originPos.y) * progress;

      // Check collision
      const hit = this.collision.checkPulseOrbCollision(orb, leftWrist, rightWrist, canvasWidth, canvasHeight);
      if (hit) {
        // Registered hit!
        const points = hit.isPower ? 150 : 100;
        const totalPoints = points * this.stats.combo;
        this.stats.score += totalPoints;
        this.stats.pulseHits++;
        if (hit.isPower) {
          this.stats.powerHits++;
          this.screenShake = 12;
        }

        // Increment combo
        this.incrementCombo();

        // Audio & Visual FX
        soundEngine.playPunch(hit.isPower, this.stats.combo);
        this.particles.spawnPunchBurst(hit.screenPos.x, hit.screenPos.y, hit.isPower);
        this.particles.addFloatingText(
          hit.isPower ? `POWER +${totalPoints}` : `+${totalPoints}`,
          hit.screenPos.x,
          hit.screenPos.y,
          hit.isPower ? '#ffd700' : '#00f3ff'
        );

        this.pulseOrbs.splice(i, 1);
        continue;
      }

      // Check miss: orb timed out past scale 1.18
      if (progress > 1.18 && !orb.isHit) {
        orb.missed = true;
        this.resetCombo();
        this.pulseOrbs.splice(i, 1);
      }
    }
  }

  private updateSolarNodes(
    now: number,
    dt: number,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    canvasWidth: number,
    canvasHeight: number
  ) {
    let anyHolding = false;
    let maxProgress = 0;

    for (let i = this.solarNodes.length - 1; i >= 0; i--) {
      const node = this.solarNodes[i];
      const elapsed = now - node.spawnTime;

      // Sine wave drift
      node.currentPos.y = node.centerPos.y + Math.sin(elapsed / 1000 * node.frequency) * node.amplitude;

      // Check hold
      const holdRes = this.collision.checkSolarNodeHold(node, leftWrist, rightWrist, dt * 1000, canvasWidth, canvasHeight);

      if (holdRes.handInNode) {
        anyHolding = true;
        maxProgress = Math.max(maxProgress, holdRes.progress);
      }

      if (holdRes.isCompleted) {
        const points = 150 * this.stats.combo;
        this.stats.score += points;
        this.stats.solarHolds++;
        this.incrementCombo();

        soundEngine.playSolarBurst();
        const px = node.currentPos.x * canvasWidth;
        const py = node.currentPos.y * canvasHeight;
        this.particles.spawnSolarBurst(px, py);
        this.particles.addFloatingText(`SOLAR +${points}!`, px, py, '#ffd700');

        this.solarNodes.splice(i, 1);
        continue;
      }

      // Check timeout
      if (elapsed > node.lifetime && !node.isCompleted) {
        node.missed = true;
        this.solarNodes.splice(i, 1);
      }
    }

    if (anyHolding) {
      soundEngine.startSolarCharge(maxProgress);
    } else {
      soundEngine.stopSolarCharge();
    }
  }

  private updateLaserBarriers(
    now: number,
    nose: Point2D | null,
    shoulderCenter: Point2D | null,
    canvasWidth: number,
    canvasHeight: number
  ) {
    for (let i = this.laserBarriers.length - 1; i >= 0; i--) {
      const barrier = this.laserBarriers[i];
      const result = this.collision.checkLaserBarrier(barrier, now, nose, shoulderCenter, this.calibration);

      if (result.collisionNow) {
        // Player hit the laser barrier!
        this.stats.lasersHit++;
        this.resetCombo();
        this.screenShake = 18;
        soundEngine.playLaserHit();

        const hitX = canvasWidth * 0.5;
        const hitY = canvasHeight * 0.4;
        this.particles.spawnLaserDamageBurst(hitX, hitY);
        this.particles.addFloatingText('BARRIER HIT!', hitX, hitY, '#ff1a40');
      }

      if (result.dodgedNow) {
        // Successfully dodged clean!
        const bonus = 200 * this.stats.combo;
        this.stats.score += bonus;
        this.stats.lasersDodged++;
        this.incrementCombo();

        soundEngine.playDodgeSuccess();
        const dodgeX = canvasWidth * 0.5;
        const dodgeY = canvasHeight * 0.25;
        this.particles.addFloatingText(`DODGED +${bonus}!`, dodgeX, dodgeY, '#39ff14');

        this.laserBarriers.splice(i, 1);
      }
    }
  }

  private incrementCombo() {
    this.stats.combo = Math.min(4, this.stats.combo + 1);
    if (this.stats.combo > this.stats.maxCombo) {
      this.stats.maxCombo = this.stats.combo;
    }
  }

  private resetCombo() {
    this.stats.combo = 1;
  }

  private saveHighScore() {
    const key = `kinetic_pulse_highscore_${this.mode}`;
    const prev = parseInt(localStorage.getItem(key) || '0', 10);
    if (this.stats.score > prev) {
      localStorage.setItem(key, String(this.stats.score));
    }
  }
}
