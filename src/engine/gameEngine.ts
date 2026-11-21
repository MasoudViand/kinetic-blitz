import {
  GameMode,
  GameState,
  DifficultyLevel,
  TutorialStep,
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
import { HistoryManager } from '../utils/historyManager';
import { GAME_TUNING } from './tuning';

export class GameEngine {
  public state: GameState = 'idle';
  public mode: GameMode = 'quick';
  public difficulty: DifficultyLevel = 'medium';
  public timeRemaining: number = 60; // In seconds
  public durationTotal: number = 60;
  public screenShake: number = 0;

  // Tutorial tracking
  public isTutorialMode: boolean = false;
  public tutorialStep: TutorialStep = 'intro';
  public tutorialCount: number = 0; // count hits/dodges in current step
  public onTutorialStepChange?: (step: TutorialStep, count: number) => void;

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

  public startSession(mode: GameMode, calibration: CalibrationData, difficulty: DifficultyLevel = 'medium') {
    this.mode = mode;
    this.difficulty = difficulty;
    this.calibration = calibration;
    this.isTutorialMode = false;
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

  public startTutorial(calibration: CalibrationData) {
    this.isTutorialMode = true;
    this.calibration = calibration;
    this.difficulty = 'easy';
    this.tutorialStep = 'intro';
    this.tutorialCount = 0;
    this.resetStats();
    this.pulseOrbs = [];
    this.solarNodes = [];
    this.laserBarriers = [];
    this.particles.clear();

    this.gameStartTime = performance.now();
    this.lastUpdateTime = performance.now();
    this.state = 'tutorial';
    this.onStateChange?.(this.state);
    this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);

    setTimeout(() => {
      if (this.state === 'tutorial') {
        this.tutorialStep = 'strike';
        this.tutorialCount = 0;
        this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);
        this.spawnTutorialTarget();
      }
    }, 1500);
  }

  public advanceTutorialStep(nextStep: TutorialStep) {
    this.tutorialStep = nextStep;
    this.tutorialCount = 0;
    this.pulseOrbs = [];
    this.solarNodes = [];
    this.laserBarriers = [];
    this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);
    this.spawnTutorialTarget();
  }

  public spawnTutorialTarget() {
    if (this.state !== 'tutorial') return;
    if (this.tutorialStep === 'strike') {
      const orb = this.targetFactory.createPulseOrb(this.calibration, 0.8, 'easy');
      // Alternate Left Hand (Cyan) and Right Hand (Magenta) for practice
      orb.color = this.tutorialCount === 0 ? '#00f3ff' : '#ff007f';
      orb.duration = 3400; // Extra readable crossing speed for learning
      this.pulseOrbs = [orb];
    } else if (this.tutorialStep === 'hold') {
      const node = this.targetFactory.createSolarNode(this.calibration, 'easy');
      node.holdDurationRequired = 500;
      node.lifetime = 6500; // Ample time to track and hold
      this.solarNodes = [node];
    } else if (this.tutorialStep === 'dodge') {
      const barrier = this.targetFactory.createLaserBarrier(this.calibration, 'easy');
      barrier.warningDuration = 2400; // Extra clear telegraph warning!
      this.laserBarriers = [barrier];
      soundEngine.playLaserWarning();
    }
  }

  public pauseSession() {
    if (this.state === 'playing' || this.state === 'tutorial') {
      this.state = 'paused';
      soundEngine.stopSolarCharge();
      this.onStateChange?.(this.state);
    }
  }

  public resumeSession() {
    if (this.state === 'paused') {
      this.lastUpdateTime = performance.now();
      this.state = this.isTutorialMode ? 'tutorial' : 'playing';
      this.onStateChange?.(this.state);
    }
  }

  public endSession() {
    this.state = 'game_over';
    soundEngine.stopSolarCharge();
    this.saveHighScore();

    // Save to workout history if a real workout was played
    if (!this.isTutorialMode && this.stats.score > 0) {
      const getRank = (score: number) => {
        if (score >= 4500) return 'S';
        if (score >= 2800) return 'A';
        if (score >= 1500) return 'B';
        return 'C';
      };

      HistoryManager.saveSession({
        mode: this.mode,
        difficulty: this.difficulty,
        posture: this.calibration.posture,
        score: this.stats.score,
        rank: getRank(this.stats.score),
        caloriesBurned: Math.round(this.stats.caloriesBurned * 10) / 10,
        durationSeconds: Math.round(this.durationTotal - this.timeRemaining),
        pulseHits: this.stats.pulseHits,
        powerHits: this.stats.powerHits,
        solarHolds: this.stats.solarHolds,
        lasersDodged: this.stats.lasersDodged,
        lasersHit: this.stats.lasersHit,
        maxCombo: this.stats.maxCombo,
      });
    }

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
    if (this.state !== 'playing' && this.state !== 'tutorial') {
      return;
    }

    const dt = Math.min(0.1, (now - this.lastUpdateTime) / 1000);
    this.lastUpdateTime = now;

    // Decay screen shake
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // 1. Update Game Session Timer & Difficulty Scaling
    if (this.state === 'playing') {
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

      // Calculate active calorie burn (scaled by difficulty METs)
      const mets = this.difficulty === 'easy' ? 5.0 : this.difficulty === 'hard' ? 8.5 : 6.5;
      this.stats.caloriesBurned += (dt * (mets * 3.5 * 70) / 200 / 60);
    }

    // 2. Collision & Motion Update
    this.collision.updateWristPositions(leftWrist, rightWrist, now);
    this.particles.recordHandPositions(
      leftWrist ? { x: leftWrist.x * canvasWidth, y: leftWrist.y * canvasHeight } : null,
      rightWrist ? { x: rightWrist.x * canvasWidth, y: rightWrist.y * canvasHeight } : null
    );
    this.particles.update(dt);

    // 3. Spawning Director (only in normal play mode)
    if (!this.isTutorialMode) {
      this.spawnDirector(now);
    }

    // 4. Update Pulse Orbs
    this.updatePulseOrbs(now, dt, leftWrist, rightWrist, canvasWidth, canvasHeight);

    // 5. Update Solar Nodes
    this.updateSolarNodes(now, dt, leftWrist, rightWrist, canvasWidth, canvasHeight);

    // 6. Update Laser Barriers
    this.updateLaserBarriers(now, nose, shoulderCenter, canvasWidth, canvasHeight);

    this.onStatsUpdate?.(this.stats);
  }

  public isInsideReachZone(pos: Point2D): boolean {
    const center = this.calibration?.shoulderCenter || { x: 0.5, y: 0.45 };
    const sw = this.calibration?.shoulderWidth || 0.22;
    const reachX = sw * 1.5;
    const minX = Math.max(0.12, center.x - reachX);
    const maxX = Math.min(0.88, center.x + reachX);
    const minY = Math.max(0.15, center.y - 0.28);
    const maxY = Math.min(0.82, center.y + 0.35);

    return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
  }

  private spawnDirector(now: number) {
    const profile = GAME_TUNING.getDifficultyProfile(this.difficulty);
    const totalActive = this.pulseOrbs.length + this.solarNodes.length;

    // Pulse Orbs spawn frequency scaled by difficulty
    const baseOrbInterval = profile.spawnIntervalBaseMs;
    const floorOrbInterval = profile.spawnIntervalFloorMs;
    const orbInterval = Math.max(floorOrbInterval, baseOrbInterval - (this.difficultyMultiplier - 1) * 350);

    // Enforce max concurrent active targets cap so slower crossings don't cause screen clutter
    if (totalActive < profile.maxConcurrentTargets && now - this.lastSpawnOrbTime > orbInterval) {
      this.pulseOrbs.push(this.targetFactory.createPulseOrb(this.calibration, this.difficultyMultiplier, this.difficulty));
      this.lastSpawnOrbTime = now;
    }

    // Solar Nodes spawn frequency: max 1 on screen at a time
    const solarInterval = this.difficulty === 'easy' ? 8500 : this.difficulty === 'hard' ? 4800 : 6500;
    if (
      totalActive < profile.maxConcurrentTargets &&
      this.solarNodes.length < GAME_TUNING.MAX_CONCURRENT_VOLT_NODES &&
      now - this.lastSpawnSolarTime > solarInterval
    ) {
      this.solarNodes.push(this.targetFactory.createSolarNode(this.calibration, this.difficulty));
      this.lastSpawnSolarTime = now;
    }

    // Laser Barriers spawn frequency
    const laserInterval = this.difficulty === 'easy' ? 14000 : this.difficulty === 'hard' ? 7000 : 9500;
    if (this.laserBarriers.length === 0 && now - this.lastSpawnLaserTime > laserInterval) {
      this.laserBarriers.push(this.targetFactory.createLaserBarrier(this.calibration, this.difficulty));
      this.lastSpawnLaserTime = now;
      soundEngine.playLaserWarning();
    }
  }

  private updatePulseOrbs(
    _now: number,
    dt: number,
    leftWrist: Point2D | null,
    rightWrist: Point2D | null,
    canvasWidth: number,
    canvasHeight: number
  ) {
    for (let i = this.pulseOrbs.length - 1; i >= 0; i--) {
      const orb = this.pulseOrbs[i];

      // 1. Telegraph Phase: Warning chevron at entry border
      if (orb.telegraphRemaining > 0) {
        orb.telegraphRemaining = Math.max(0, orb.telegraphRemaining - dt * 1000);
        orb.currentPos.x = orb.spawnX;
        orb.currentPos.y = orb.spawnY;
        orb.progress = 0;
        continue;
      }

      // 2. Cross-Screen Traversal Phase with Reach-Zone Speed Brake (25% slowdown inside reach zone)
      const baseSpeed = 1 / (orb.duration / 1000);
      const inReach = this.isInsideReachZone(orb.currentPos);
      const speedFactor = inReach ? GAME_TUNING.REACH_ZONE_SPEED_FACTOR : 1.0;
      orb.progress = Math.min(1.3, orb.progress + dt * baseSpeed * speedFactor);
      const progress = orb.progress;

      // Linear base path from spawn to opposite border exit
      const baseX = orb.spawnX + (orb.exitX - orb.spawnX) * progress;
      const baseY = orb.spawnY + (orb.exitY - orb.spawnY) * progress;

      // Slight perpendicular quadratic arc curve for visual variety
      const perpX = -orb.vy;
      const perpY = orb.vx;
      const curve = Math.sin(Math.min(1.0, progress) * Math.PI) * orb.arcOffset;

      orb.currentPos.x = baseX + perpX * curve;
      orb.currentPos.y = baseY + perpY * curve;

      // Check collision anywhere along cross-screen traversal
      const hit = this.collision.checkPulseOrbCollision(orb, leftWrist, rightWrist, canvasWidth, canvasHeight, this.isTutorialMode);
      if (hit) {
        // Points: base 100, Power +50, Directional counter +50
        let points = 100;
        if (hit.isPower) points += 50;
        if (hit.isDirectionalCounter) points += 50;

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
        this.particles.spawnPunchBurst(hit.screenPos.x, hit.screenPos.y, hit.isPower, hit.orb.color);

        const label = hit.isDirectionalCounter && hit.isPower
          ? `COUNTER POWER +${totalPoints}`
          : hit.isPower
          ? `POWER +${totalPoints}`
          : hit.isDirectionalCounter
          ? `COUNTER +${totalPoints}`
          : `+${totalPoints}`;

        this.particles.addFloatingText(
          label,
          hit.screenPos.x,
          hit.screenPos.y,
          hit.isPower ? '#ffd700' : hit.isDirectionalCounter ? '#ff007f' : hit.orb.color
        );

        this.pulseOrbs.splice(i, 1);
        if (this.isTutorialMode && this.tutorialStep === 'strike') {
          this.tutorialCount++;
          this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);
          if (this.tutorialCount >= 2) {
            setTimeout(() => this.advanceTutorialStep('hold'), 1000);
          } else {
            setTimeout(() => this.spawnTutorialTarget(), 800);
          }
        }
        continue;
      }

      // Check escape: orb crosses exit point and exits screen, or exceeds traversal window
      const orbPixelX = orb.currentPos.x * canvasWidth;
      const orbPixelY = orb.currentPos.y * canvasHeight;
      const currentRadius = orb.radius;

      const isOffscreen =
        orbPixelX + currentRadius < 0 ||
        orbPixelX - currentRadius > canvasWidth ||
        orbPixelY + currentRadius < 0 ||
        orbPixelY - currentRadius > canvasHeight;

      if ((progress >= 1.0 && isOffscreen) || progress >= 1.25) {
        orb.escaped = true;
        orb.missed = true;
        this.resetCombo();
        this.pulseOrbs.splice(i, 1);
        if (this.isTutorialMode && this.tutorialStep === 'strike') {
          setTimeout(() => this.spawnTutorialTarget(), 600);
        }
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

      // 1. Telegraph Phase at entry border
      if (node.telegraphRemaining > 0) {
        node.telegraphRemaining = Math.max(0, node.telegraphRemaining - dt * 1000);
        node.currentPos.x = node.spawnX;
        node.currentPos.y = node.spawnY;
        node.progress = 0;
        continue;
      }

      // 2. Traversal with Reach-Zone Brake & Volt Node Gravity Brake
      // When player is grabbing the node (node.isHeld), slow its traversal speed by 70% (0.30 multiplier)
      const baseSpeed = 1 / (node.lifetime / 1000);
      const inReach = this.isInsideReachZone(node.currentPos);
      let speedFactor = inReach ? GAME_TUNING.REACH_ZONE_SPEED_FACTOR : 1.0;
      if (node.isHeld) {
        speedFactor *= GAME_TUNING.VOLT_HELD_SPEED_MULTIPLIER; // Gravity Brake
      }
      node.progress = Math.min(1.3, node.progress + dt * baseSpeed * speedFactor);
      const progress = node.progress;

      const baseX = node.spawnX + (node.exitX - node.spawnX) * progress;
      const baseY = node.spawnY + (node.exitY - node.spawnY) * progress;

      const perpX = -node.vy;
      const perpY = node.vx;
      const activeElapsed = now - (node.spawnTime + node.telegraphDuration);
      const sway = Math.sin((activeElapsed / 1000) * node.frequency * Math.PI * 2) * node.amplitude;
      const curve = Math.sin(Math.min(1.0, progress) * Math.PI) * node.arcOffset;

      node.currentPos.x = baseX + perpX * (curve + sway);
      node.currentPos.y = baseY + perpY * (curve + sway);

      // Check hold
      const holdRes = this.collision.checkSolarNodeHold(node, leftWrist, rightWrist, dt * 1000, canvasWidth, canvasHeight);

      if (holdRes.handInNode) {
        anyHolding = true;
        maxProgress = Math.max(maxProgress, holdRes.progress);
      }

      if (holdRes.isCompleted) {
        const points = 300 * this.stats.combo;
        this.stats.score += points;
        this.stats.solarHolds++;
        this.incrementCombo();

        soundEngine.playSolarBurst();
        const px = node.currentPos.x * canvasWidth;
        const py = node.currentPos.y * canvasHeight;
        this.particles.spawnSolarBurst(px, py);
        this.particles.addFloatingText(`SOLAR +${points}!`, px, py, '#ffd700');

        this.solarNodes.splice(i, 1);
        if (this.isTutorialMode && this.tutorialStep === 'hold') {
          this.tutorialCount++;
          this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);
          setTimeout(() => this.advanceTutorialStep('dodge'), 1000);
        }
        continue;
      }

      // Check escape: passed opposite border
      const nodePixelX = node.currentPos.x * canvasWidth;
      const nodePixelY = node.currentPos.y * canvasHeight;
      const r = node.radius;

      const isOffscreen =
        nodePixelX + r < 0 ||
        nodePixelX - r > canvasWidth ||
        nodePixelY + r < 0 ||
        nodePixelY - r > canvasHeight;

      if ((progress >= 1.0 && isOffscreen) || progress >= 1.25) {
        node.escaped = true;
        node.missed = true;
        this.resetCombo();
        this.solarNodes.splice(i, 1);
        if (this.isTutorialMode && this.tutorialStep === 'hold') {
          setTimeout(() => this.spawnTutorialTarget(), 600);
        }
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
        if (this.isTutorialMode && this.tutorialStep === 'dodge') {
          this.tutorialCount++;
          this.onTutorialStepChange?.(this.tutorialStep, this.tutorialCount);
          setTimeout(() => this.advanceTutorialStep('outro'), 1000);
        }
        continue;
      }

      // Barrier duration finished but was not dodged (hit or didn't duck)
      if (result.isFinished) {
        this.laserBarriers.splice(i, 1);
        if (this.isTutorialMode && this.tutorialStep === 'dodge') {
          this.particles.addFloatingText('TRY AGAIN - SQUAT OR LEAN!', canvasWidth * 0.5, canvasHeight * 0.35, '#ffaa00');
          setTimeout(() => {
            if (this.state === 'tutorial' && this.tutorialStep === 'dodge') {
              this.spawnTutorialTarget();
            }
          }, 1200);
        }
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
    const key = `kinetic_blitz_highscore_${this.mode}`;
    const prev = parseInt(localStorage.getItem(key) || localStorage.getItem(`kinetic_pulse_highscore_${this.mode}`) || '0', 10);
    if (this.stats.score > prev) {
      localStorage.setItem(key, String(this.stats.score));
    }
  }
}
