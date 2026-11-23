import * as THREE from 'three';
import { GameMode, DifficultyLevel } from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import {
  VrPhase,
  VrGameState,
  VrHandInfo,
  VrBlitzOrb,
  VrVoltNode,
  VrLaserBarrier,
  VrLaserOrientation,
  VrCalibration,
  VrStats,
  VrParticleData,
} from './vrTypes';

export class VrEngine {
  public state: VrGameState = 'idle';
  public mode: GameMode = 'quick';
  public difficulty: DifficultyLevel = 'medium';

  // Real-world calibration anchor
  public calibration: VrCalibration = {
    playerOrigin: new THREE.Vector3(0, 0, 0),
    headY: 1.65,
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    forwardYaw: 0,
    calibrated: false,
    headDriftDistance: 0,
    isDrifted: false,
  };

  public justResumed: boolean = false;

  public get phase(): VrPhase {
    if (this.state === 'countdown' || this.state === 'calibrating' || this.state === 'idle') {
      return 'CALIBRATING';
    }
    if (this.state === 'playing') return 'PLAYING';
    if (this.state === 'paused') return 'PAUSED';
    return 'SUMMARY';
  }

  // Active targets
  public blitzOrbs: VrBlitzOrb[] = [];
  public voltNodes: VrVoltNode[] = [];
  public laserBarriers: VrLaserBarrier[] = [];

  // Hands tracking state
  public hands: { left: VrHandInfo; right: VrHandInfo } = {
    left: {
      handedness: 'left',
      position: new THREE.Vector3(-0.2, 1.4, -0.4),
      velocity: new THREE.Vector3(),
      prevPosition: new THREE.Vector3(-0.2, 1.4, -0.4),
      active: false,
      inputSource: null,
      lastHapticTime: 0,
      lastVoltPulseTime: 0,
    },
    right: {
      handedness: 'right',
      position: new THREE.Vector3(0.2, 1.4, -0.4),
      velocity: new THREE.Vector3(),
      prevPosition: new THREE.Vector3(0.2, 1.4, -0.4),
      active: false,
      inputSource: null,
      lastHapticTime: 0,
      lastVoltPulseTime: 0,
    },
  };

  // Player Stats
  public stats: VrStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    pulseHits: 0,
    powerHits: 0,
    solarHolds: 0,
    lasersDodged: 0,
    lasersHit: 0,
    caloriesBurned: 0,
    overdrive: 0,
    isOverdrive: false,
    totalStrikesAttempted: 0,
  };

  // Timers & Session State
  public timeRemaining: number = 60;
  public elapsedTime: number = 0;
  public sessionStartTime: number = 0;
  public countdownValue: number = 3;
  private countdownElapsed: number = 0;
  private lastCountdownBeep: number = -1;

  // Spawner timers
  private nextTargetSpawnTime: number = 0;
  private nextLaserSpawnTime: number = 6000;
  private orbCounter: number = 0;

  // Particle pool for zero-GC hit explosions
  public static readonly MAX_PARTICLES = 160;
  public particles: VrParticleData[] = [];
  private nextParticleIdx = 0;

  // Callbacks for UI/HUD changes
  public onHudDirty?: () => void;
  public onStateChange?: (state: VrGameState) => void;
  public onTargetsListChanged?: () => void; // Triggered when targets added/removed

  constructor() {
    this.initParticlePool();
  }

  private initParticlePool() {
    this.particles = [];
    for (let i = 0; i < VrEngine.MAX_PARTICLES; i++) {
      this.particles.push({
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        color: new THREE.Color('#00f0ff'),
        size: 0.03,
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  /**
   * Coordinate Frame: Local (relative to player looking down -Z) to World
   */
  public localToWorld(local: THREE.Vector3, out?: THREE.Vector3): THREE.Vector3 {
    const res = out || new THREE.Vector3();
    res.copy(this.calibration.playerOrigin);
    res.addScaledVector(this.calibration.right, local.x);
    res.y = local.y;
    res.addScaledVector(this.calibration.forward, -local.z);
    return res;
  }

  /**
   * Coordinate Frame: World to Local (relative to player looking down -Z)
   */
  public worldToLocal(world: THREE.Vector3, out?: THREE.Vector3): THREE.Vector3 {
    const res = out || new THREE.Vector3();
    const dx = world.x - this.calibration.playerOrigin.x;
    const dz = world.z - this.calibration.playerOrigin.z;
    res.x = dx * this.calibration.right.x + dz * this.calibration.right.z;
    res.y = world.y;
    res.z = -(dx * this.calibration.forward.x + dz * this.calibration.forward.z);
    return res;
  }

  /**
   * Recalibrate coordinate frame to player's current real-world head position and facing direction
   */
  public recalibrate(camera: THREE.Camera) {
    const headPos = camera.position;
    const headY = Math.max(headPos.y, 0.8);
    this.calibration.headY = headY;
    this.calibration.playerOrigin.set(headPos.x, 0, headPos.z);

    // Extract horizontal forward direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    this.calibration.forward.copy(forward);

    // Extract horizontal right direction (Forward x (0,1,0))
    this.calibration.right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Yaw angle: 0 rad when looking down -Z
    this.calibration.forwardYaw = Math.atan2(-forward.x, -forward.z);
    this.calibration.calibrated = true;

    this.onHudDirty?.();
  }

  /**
   * Start a new VR workout session
   */
  public startSession(mode: GameMode, difficulty: DifficultyLevel, camera?: THREE.Camera) {
    this.mode = mode;
    this.difficulty = difficulty;
    if (camera) {
      this.recalibrate(camera);
    }

    this.stats = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      pulseHits: 0,
      powerHits: 0,
      solarHolds: 0,
      lasersDodged: 0,
      lasersHit: 0,
      caloriesBurned: 0,
      overdrive: 0,
      isOverdrive: false,
      totalStrikesAttempted: 0,
    };

    this.blitzOrbs = [];
    this.voltNodes = [];
    this.laserBarriers = [];
    this.onTargetsListChanged?.();

    const durationMap: Record<GameMode, number> = {
      quick: 60,
      endurance: 180,
      endless: 999999,
    };
    this.timeRemaining = durationMap[mode];
    this.elapsedTime = 0;
    this.countdownValue = 3;
    this.countdownElapsed = 0;
    this.lastCountdownBeep = -1;
    this.state = 'countdown';
    this.onStateChange?.(this.state);
    this.onHudDirty?.();
  }

  /**
   * Pause active session: freezes spawns, timers, and targets in place
   */
  public pauseGame() {
    if (this.state === 'playing' || this.state === 'countdown') {
      this.state = 'paused';
      soundEngine.stopSolarCharge();
      this.onStateChange?.(this.state);
      this.onHudDirty?.();
    }
  }

  /**
   * Resume paused session without forward target jumps
   */
  public resumeGame() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this.justResumed = true;
      this.onStateChange?.(this.state);
      this.onHudDirty?.();
    }
  }

  /**
   * Restart session cleanly
   */
  public restartGame(camera?: THREE.Camera) {
    soundEngine.stopSolarCharge();
    this.startSession(this.mode, this.difficulty, camera);
  }

  /**
   * Update hand position and calculate smoothed 3D velocity
   */
  public updateHand(
    handedness: 'left' | 'right',
    worldPos: THREE.Vector3,
    inputSource: XRInputSource | null,
    dt: number
  ) {
    const hand = this.hands[handedness];
    hand.inputSource = inputSource;
    hand.active = true;

    if (dt > 0.0001 && dt < 0.2) {
      const instantVx = (worldPos.x - hand.prevPosition.x) / dt;
      const instantVy = (worldPos.y - hand.prevPosition.y) / dt;
      const instantVz = (worldPos.z - hand.prevPosition.z) / dt;

      const alpha = 0.6;
      hand.velocity.x = hand.velocity.x * (1 - alpha) + instantVx * alpha;
      hand.velocity.y = hand.velocity.y * (1 - alpha) + instantVy * alpha;
      hand.velocity.z = hand.velocity.z * (1 - alpha) + instantVz * alpha;
    }

    hand.prevPosition.copy(worldPos);
    hand.position.copy(worldPos);
  }

  /**
   * Native WebXR haptics
   */
  public pulseHaptic(handedness: 'left' | 'right', intensity: number, durationMs: number) {
    const hand = this.hands[handedness];
    const gamepad = hand.inputSource?.gamepad;
    if (!gamepad) return;

    const actuators = gamepad.hapticActuators;
    if (actuators && actuators.length > 0 && actuators[0]) {
      try {
        actuators[0].pulse(Math.min(1.0, Math.max(0.0, intensity)), durationMs);
      } catch {
        // Safe fallback
      }
    }
  }

  public pulseBothHaptics(intensity: number, durationMs: number) {
    this.pulseHaptic('left', intensity, durationMs);
    this.pulseHaptic('right', intensity, durationMs);
  }

  /**
   * Hit sparks explosion
   */
  public emitHitSparks(position: THREE.Vector3, hexColor: string, count = 18, isPower = false) {
    const color = new THREE.Color(hexColor);
    const speedBase = isPower ? 3.6 : 2.4;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextParticleIdx];
      this.nextParticleIdx = (this.nextParticleIdx + 1) % VrEngine.MAX_PARTICLES;

      p.active = true;
      p.life = 0;
      p.maxLife = isPower ? 0.45 : 0.32;
      p.color.copy(color);
      p.size = isPower ? 0.045 : 0.028;
      p.position.copy(position);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = speedBase * (0.6 + Math.random() * 0.8);

      p.velocity.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed + 0.3,
        Math.cos(phi) * speed
      );
    }
  }

  /**
   * Spawn incoming Blitz Orb along depth corridor (Z = -5.5m -> -0.45m)
   */
  private spawnBlitzOrb() {
    const headY = this.calibration.headY;

    // 1. Guaranteed reachable punch target in front of player
    const targetLocal = new THREE.Vector3(
      THREE.MathUtils.randFloat(-0.38, 0.38),
      THREE.MathUtils.randFloat(headY - 0.40, headY + 0.08),
      -0.45 // Comfortable arm-reach punch distance
    );

    // 2. Spawn point 5.5m down the corridor with slight lateral flare
    const spawnLocal = new THREE.Vector3(
      targetLocal.x * 2.2 + THREE.MathUtils.randFloat(-0.4, 0.4),
      targetLocal.y + THREE.MathUtils.randFloat(-0.25, 0.35),
      -5.5
    );

    // 3. Exit point passing behind shoulders
    const exitLocal = new THREE.Vector3(
      targetLocal.x * 1.1 + THREE.MathUtils.randFloat(-0.1, 0.1),
      targetLocal.y,
      0.35
    );

    // 4. Solve quadratic Bézier control point so curve passes right through targetLocal at t_hit
    // Distance from z=-5.5 to z=-0.45 is 5.05m; total z is 5.85m -> t_hit approx 0.86
    const tHit = 0.86;
    const invT = 1 - tHit;
    const denom = 2 * invT * tHit;

    const controlLocal = new THREE.Vector3(
      (targetLocal.x - invT * invT * spawnLocal.x - tHit * tHit * exitLocal.x) / denom,
      (targetLocal.y - invT * invT * spawnLocal.y - tHit * tHit * exitLocal.y) / denom,
      (targetLocal.z - invT * invT * spawnLocal.z - tHit * tHit * exitLocal.z) / denom
    );

    // Approach duration by difficulty
    const durationMap: Record<DifficultyLevel, number> = {
      easy: 2600,
      medium: 2000,
      hard: 1500,
    };
    const approachDuration = durationMap[this.difficulty];
    const totalDuration = approachDuration / tHit;

    const color: 'cyan' | 'magenta' = this.orbCounter % 2 === 0 ? 'cyan' : 'magenta';
    this.orbCounter++;

    const initialWorld = this.localToWorld(spawnLocal);

    this.blitzOrbs.push({
      id: `vr-orb-${Date.now()}-${Math.random()}`,
      kind: 'blitz_orb',
      color,
      localPos: spawnLocal.clone(),
      worldPos: initialWorld,
      spawnLocal,
      targetLocal,
      exitLocal,
      controlLocal,
      radius: 0.12,
      approachDuration,
      totalDuration,
      elapsed: 0,
      isHit: false,
      isPower: false,
      isMissed: false,
      inStrikeZone: false,
    });

    this.onTargetsListChanged?.();
  }

  /**
   * Spawn incoming Volt Node: approaches from 5.5m, locks at z = -0.42m, glides across chest
   */
  private spawnVoltNode() {
    if (this.voltNodes.length >= 1) return;

    const headY = this.calibration.headY;
    const glideY = THREE.MathUtils.randFloat(headY - 0.35, headY + 0.05);

    // Decide glide direction (left-to-right or right-to-left)
    const fromLeft = Math.random() < 0.5;
    const glideStartX = fromLeft ? -0.35 : 0.35;
    const glideEndX = fromLeft ? 0.35 : -0.35;

    const spawnLocal = new THREE.Vector3(glideStartX, glideY, -5.5);
    const initialWorld = this.localToWorld(spawnLocal);

    this.voltNodes.push({
      id: `vr-volt-${Date.now()}-${Math.random()}`,
      kind: 'volt_node',
      phase: 'approach',
      localPos: spawnLocal.clone(),
      worldPos: initialWorld,
      spawnLocal,
      glideY,
      glideStartX,
      glideEndX,
      approachDuration: 1800, // 1.8s approach
      glideDuration: 4000,    // 4.0s glide at arm's reach
      approachElapsed: 0,
      glideElapsed: 0,
      radius: 0.13,
      holdProgress: 0,
      holdDurationMs: 450,
      isHeld: false,
      heldHand: null,
      isBurst: false,
      isMissed: false,
    });

    this.onTargetsListChanged?.();
  }

  /**
   * Spawn Laser Barrier aligned to the player's corridor
   */
  private spawnLaserBarrier(timeMs: number) {
    if (this.laserBarriers.length > 0) return;

    const orientations: VrLaserOrientation[] = [
      'horizontal_squat',
      'vertical_left',
      'vertical_right',
    ];
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];

    const speed = 2.4; // m/s
    const startLocalZ = -5.5;

    // Overhead bar bottom edge at headY - 0.25m (center at headY - 0.16m, height 0.18m)
    const barY = this.calibration.headY - 0.16;
    // Vertical beam at lateral offset 0.36m (only requires upper-body lean of ~0.28m-0.32m)
    const beamX = orientation === 'vertical_left' ? -0.36 : orientation === 'vertical_right' ? 0.36 : 0;

    const initialWorld = this.localToWorld(new THREE.Vector3(beamX, barY, startLocalZ));

    this.laserBarriers.push({
      id: `vr-laser-${Date.now()}`,
      kind: 'laser_barrier',
      orientation,
      localZ: startLocalZ,
      worldPos: initialWorld,
      worldRotationY: this.calibration.forwardYaw,
      speed,
      elapsed: 0,
      active: true,
      hasCollided: false,
      isDodged: false,
      barY,
      beamX,
      width: orientation === 'horizontal_squat' ? 1.6 : 0.38,
      height: orientation === 'horizontal_squat' ? 0.18 : 1.35,
    });

    soundEngine.playLaserWarning();
    this.nextLaserSpawnTime = timeMs + THREE.MathUtils.randFloat(10000, 15000);
    this.onTargetsListChanged?.();
  }

  /**
   * Main imperative simulation step called inside R3F useFrame
   */
  public update(deltaSeconds: number, camera: THREE.Camera, nowMs: number) {
    // Reset delta clamp after resuming so targets never jump forward
    if (this.justResumed) {
      deltaSeconds = 0.0001;
      this.justResumed = false;
    }

    const dtMs = deltaSeconds * 1000;

    // Head-Drift Guard: measure distance from calibrated playspace center
    const driftX = camera.position.x - this.calibration.playerOrigin.x;
    const driftZ = camera.position.z - this.calibration.playerOrigin.z;
    this.calibration.headDriftDistance = Math.hypot(driftX, driftZ);
    this.calibration.isDrifted = this.calibration.headDriftDistance > 0.40;

    // 1. Update Particles Pool (always runs so explosions fade smoothly)
    for (let i = 0; i < VrEngine.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += deltaSeconds;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.position.set(0, -999, 0);
      } else {
        p.position.addScaledVector(p.velocity, deltaSeconds);
        p.velocity.y -= 3.2 * deltaSeconds;
      }
    }

    // Freeze game loop if paused or in summary
    if (this.state === 'paused' || this.state === 'game_over' || this.state === 'summary') {
      return;
    }

    // Handle Countdown State
    if (this.state === 'countdown') {
      this.countdownElapsed += dtMs;
      const count = 3 - Math.floor(this.countdownElapsed / 1000);

      if (count !== this.lastCountdownBeep && count >= 1 && count <= 3) {
        this.lastCountdownBeep = count;
        soundEngine.playCountdown(false);
        this.countdownValue = count;
        this.onHudDirty?.();
      }

      if (this.countdownElapsed >= 3000) {
        soundEngine.playCountdown(true);
        this.state = 'playing';
        this.sessionStartTime = nowMs;
        this.nextTargetSpawnTime = nowMs + 400;
        this.nextLaserSpawnTime = nowMs + 9000;
        this.onStateChange?.(this.state);
        this.onHudDirty?.();
      }
      return;
    }

    if (this.state !== 'playing') {
      return;
    }

    // Handle Timers & Calories
    this.elapsedTime += deltaSeconds;
    if (this.mode !== 'endless') {
      this.timeRemaining -= deltaSeconds;
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.state = 'game_over';
        soundEngine.stopSolarCharge();
        this.onStateChange?.(this.state);
        this.onHudDirty?.();
        return;
      }
    }

    this.stats.caloriesBurned = Math.floor((this.elapsedTime / 60) * 8.5);

    if (this.stats.overdrive > 0 && !this.stats.isOverdrive) {
      this.stats.overdrive = Math.max(0, this.stats.overdrive - deltaSeconds * 2.5);
    } else if (this.stats.isOverdrive) {
      this.stats.overdrive -= deltaSeconds * 9.0;
      if (this.stats.overdrive <= 0) {
        this.stats.overdrive = 0;
        this.stats.isOverdrive = false;
      }
    }

    // 2. Spawn Targets
    if (nowMs >= this.nextTargetSpawnTime) {
      const maxTargets = this.difficulty === 'hard' ? 4 : 3;
      const totalActive = this.blitzOrbs.length + this.voltNodes.length;

      if (totalActive < maxTargets) {
        const canSpawnVolt = this.voltNodes.length === 0 && this.stats.pulseHits >= 2;
        if (canSpawnVolt && Math.random() < 0.25) {
          this.spawnVoltNode();
        } else {
          this.spawnBlitzOrb();
        }
      }

      const spawnInterval = this.difficulty === 'hard' ? 1200 : this.difficulty === 'medium' ? 1500 : 1800;
      this.nextTargetSpawnTime = nowMs + spawnInterval;
    }

    if (nowMs >= this.nextLaserSpawnTime) {
      this.spawnLaserBarrier(nowMs);
    }

    let targetsListChanged = false;

    // 3. Update Blitz Orbs (Quadratic Bézier depth corridor)
    for (let i = this.blitzOrbs.length - 1; i >= 0; i--) {
      const orb = this.blitzOrbs[i];
      orb.elapsed += dtMs;

      const t = Math.min(1.0, orb.elapsed / orb.totalDuration);
      const invT = 1 - t;

      // Quadratic Bézier: B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
      orb.localPos.x = invT * invT * orb.spawnLocal.x + 2 * invT * t * orb.controlLocal.x + t * t * orb.exitLocal.x;
      orb.localPos.y = invT * invT * orb.spawnLocal.y + 2 * invT * t * orb.controlLocal.y + t * t * orb.exitLocal.y;
      orb.localPos.z = invT * invT * orb.spawnLocal.z + 2 * invT * t * orb.controlLocal.z + t * t * orb.exitLocal.z;

      // Update world position
      this.localToWorld(orb.localPos, orb.worldPos);

      // Check punch-ready reach zone (-0.80m <= z <= +0.10m)
      const inReach = orb.localPos.z >= -0.80 && orb.localPos.z <= 0.10;
      orb.inStrikeZone = inReach;

      // Fist collision check
      // Effective strike threshold: orb radius (0.12) + fist collider (0.09) * 1.25x = 0.2625m
      const strikeRadius = (orb.radius + 0.09) * 1.25;
      let hitByHand: VrHandInfo | null = null;

      if (inReach) {
        if (this.hands.left.active && this.hands.left.position.distanceTo(orb.worldPos) <= strikeRadius) {
          hitByHand = this.hands.left;
        } else if (this.hands.right.active && this.hands.right.position.distanceTo(orb.worldPos) <= strikeRadius) {
          hitByHand = this.hands.right;
        }
      }

      if (hitByHand) {
        orb.isHit = true;
        this.stats.totalStrikesAttempted++;
        this.stats.pulseHits++;

        const punchSpeed = hitByHand.velocity.length();
        const isPower = punchSpeed >= 2.0;
        if (isPower) {
          this.stats.powerHits++;
        }

        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
          this.stats.maxCombo = this.stats.combo;
        }

        let points = isPower ? 250 : 100;
        points *= Math.min(this.stats.combo, 10);
        this.stats.score += points;

        this.stats.overdrive = Math.min(100, this.stats.overdrive + (isPower ? 8 : 4));
        if (this.stats.overdrive >= 100) {
          this.stats.isOverdrive = true;
        }

        const hapticIntensity = isPower ? 0.95 : 0.55;
        const hapticDuration = isPower ? 110 : 60;
        this.pulseHaptic(hitByHand.handedness, hapticIntensity, hapticDuration);
        soundEngine.playPunch(isPower, this.stats.combo);

        this.emitHitSparks(
          orb.worldPos,
          orb.color === 'cyan' ? '#00f0ff' : '#ff0077',
          isPower ? 26 : 16,
          isPower
        );

        this.blitzOrbs.splice(i, 1);
        targetsListChanged = true;
        this.onHudDirty?.();
        continue;
      }

      // Miss check: passed behind player shoulders
      if (orb.localPos.z >= 0.25 || t >= 1.0) {
        orb.isMissed = true;
        this.stats.combo = 0;
        this.blitzOrbs.splice(i, 1);
        targetsListChanged = true;
        this.onHudDirty?.();
      }
    }

    // 4. Update Volt Nodes (Approach -> Lock at z = -0.42m -> Lateral Glide)
    for (let i = this.voltNodes.length - 1; i >= 0; i--) {
      const node = this.voltNodes[i];

      if (node.phase === 'approach') {
        node.approachElapsed += dtMs;
        const tApp = Math.min(1.0, node.approachElapsed / node.approachDuration);

        // Lerp from -5.5m to -0.42m
        node.localPos.x = node.glideStartX;
        node.localPos.y = node.glideY;
        node.localPos.z = THREE.MathUtils.lerp(-5.5, -0.42, tApp);

        if (tApp >= 1.0) {
          node.phase = 'glide';
          node.localPos.z = -0.42; // Locked at arm's reach
        }
      } else if (node.phase === 'glide') {
        // Sticky hysteresis grab radius
        const grabRadius = node.radius * 1.4;
        const maintainRadius = node.radius * 1.9;

        let touchingHand: VrHandInfo | null = null;
        if (node.isHeld && node.heldHand) {
          const hand = this.hands[node.heldHand];
          if (hand.active && hand.position.distanceTo(node.worldPos) <= maintainRadius) {
            touchingHand = hand;
          }
        } else {
          if (this.hands.left.active && this.hands.left.position.distanceTo(node.worldPos) <= grabRadius) {
            touchingHand = this.hands.left;
          } else if (this.hands.right.active && this.hands.right.position.distanceTo(node.worldPos) <= grabRadius) {
            touchingHand = this.hands.right;
          }
        }

        if (touchingHand) {
          node.isHeld = true;
          node.heldHand = touchingHand.handedness;

          // Gravity brake: lateral speed slowed by 70%
          node.glideElapsed += dtMs * 0.30;
          node.holdProgress = Math.min(1.0, node.holdProgress + dtMs / node.holdDurationMs);

          if (nowMs - touchingHand.lastVoltPulseTime >= 80) {
            touchingHand.lastVoltPulseTime = nowMs;
            this.pulseHaptic(touchingHand.handedness, 0.20, 30);
          }

          soundEngine.startSolarCharge(node.holdProgress);

          // Burst at 100% hold (450ms)
          if (node.holdProgress >= 1.0) {
            node.isBurst = true;
            this.stats.solarHolds++;
            this.stats.combo += 2;
            if (this.stats.combo > this.stats.maxCombo) {
              this.stats.maxCombo = this.stats.combo;
            }
            this.stats.score += 350 * Math.min(this.stats.combo, 10);
            this.stats.overdrive = Math.min(100, this.stats.overdrive + 15);

            this.pulseHaptic(touchingHand.handedness, 0.85, 120);
            soundEngine.playSolarBurst();
            this.emitHitSparks(node.worldPos, '#ffd700', 30, true);

            this.voltNodes.splice(i, 1);
            targetsListChanged = true;
            this.onHudDirty?.();
            continue;
          }
        } else {
          if (node.isHeld) {
            node.isHeld = false;
            node.heldHand = null;
            soundEngine.stopSolarCharge();
          }

          // Smooth charge decay at 0.5x rate if hand slips
          node.holdProgress = Math.max(0, node.holdProgress - (dtMs / node.holdDurationMs) * 0.5);
          node.glideElapsed += dtMs;
        }

        // Glides across chest at locked z = -0.42m
        const tGlide = Math.min(1.0, node.glideElapsed / node.glideDuration);
        node.localPos.x = THREE.MathUtils.lerp(node.glideStartX, node.glideEndX, tGlide);
        node.localPos.y = node.glideY;
        node.localPos.z = -0.42; // Always locked at comfortable punch distance

        // Expire when glide finishes uncharged
        if (tGlide >= 1.0) {
          node.isMissed = true;
          if (node.isHeld) {
            soundEngine.stopSolarCharge();
          }
          this.voltNodes.splice(i, 1);
          targetsListChanged = true;
          this.onHudDirty?.();
          continue;
        }
      }

      this.localToWorld(node.localPos, node.worldPos);
    }

    // 5. Update Laser Barriers
    const localHead = this.worldToLocal(camera.position);

    for (let i = this.laserBarriers.length - 1; i >= 0; i--) {
      const laser = this.laserBarriers[i];
      laser.elapsed += dtMs;
      laser.localZ += laser.speed * deltaSeconds;

      // Update world position & rotation
      this.localToWorld(new THREE.Vector3(laser.beamX, laser.barY, laser.localZ), laser.worldPos);
      laser.worldRotationY = this.calibration.forwardYaw;

      // Crossing active player collision zone
      if (laser.localZ >= -0.30 && laser.localZ <= 0.30 && !laser.hasCollided && !laser.isDodged) {
        let isHit = false;

        if (laser.orientation === 'horizontal_squat') {
          // Bottom edge at headY - 0.25m (comfortable in-place knee bend squat)
          if (localHead.y > this.calibration.headY - 0.22) {
            isHit = true;
          }
        } else if (laser.orientation === 'vertical_left') {
          // Upper-body lean right by ~0.28m-0.32m avoids left barrier
          if (localHead.x < 0.10) {
            isHit = true;
          }
        } else if (laser.orientation === 'vertical_right') {
          // Upper-body lean left by ~0.28m-0.32m avoids right barrier
          if (localHead.x > -0.10) {
            isHit = true;
          }
        }

        if (isHit) {
          laser.hasCollided = true;
          this.stats.lasersHit++;
          this.stats.combo = 0;
          this.stats.score = Math.max(0, this.stats.score - 100);

          this.pulseBothHaptics(0.75, 160);
          soundEngine.playLaserHit();
          this.onHudDirty?.();
        } else {
          laser.isDodged = true;
          this.stats.lasersDodged++;
          this.stats.combo++;
          if (this.stats.combo > this.stats.maxCombo) {
            this.stats.maxCombo = this.stats.combo;
          }
          this.stats.score += 150 * Math.min(this.stats.combo, 10);

          soundEngine.playDodgeSuccess();
          this.onHudDirty?.();
        }
      }

      if (laser.localZ > 0.8) {
        this.laserBarriers.splice(i, 1);
        targetsListChanged = true;
      }
    }

    if (targetsListChanged) {
      this.onTargetsListChanged?.();
    }
  }

  public resetSession(camera?: THREE.Camera) {
    this.restartGame(camera);
  }
}

export const vrEngine = new VrEngine();
