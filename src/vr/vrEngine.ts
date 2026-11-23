import * as THREE from 'three';
import { GameMode, DifficultyLevel } from '../types/game';
import { DIFFICULTY_PROFILES, GAME_TUNING } from '../engine/tuning';
import { soundEngine } from '../audio/soundEngine';
import {
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

  // Real-world calibration
  public calibration: VrCalibration = {
    headY: 1.65,
    headPosition: new THREE.Vector3(0, 1.65, 0),
    forward: new THREE.Vector3(0, 0, -1),
    strikeCenter: new THREE.Vector3(0, 1.45, -0.55),
    strikeHalfWidth: 0.55,
    strikeMinY: 1.10,
    strikeMaxY: 1.80,
    strikeZ: -0.55,
    calibrated: false,
  };

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

  // Timer & Session state
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

  // Callbacks for HUD changes to avoid per-frame texture rerenders
  public onHudDirty?: () => void;
  public onStateChange?: (state: VrGameState) => void;

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
   * Recalibrate strike plane to headset position and eye-level
   */
  public recalibrate(camera: THREE.Camera) {
    const headPos = camera.position;
    const y = Math.max(headPos.y, 0.8);
    this.calibration.headY = y;
    this.calibration.headPosition.copy(headPos);

    // Get horizontal forward direction
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    this.calibration.forward.copy(forward);

    // Center strike plane 0.55m in front of player
    this.calibration.strikeZ = -0.55;
    this.calibration.strikeHalfWidth = 0.55;
    this.calibration.strikeMinY = y - 0.55;
    this.calibration.strikeMaxY = y + 0.15;
    this.calibration.strikeCenter.set(
      headPos.x + forward.x * 0.55,
      y - 0.20,
      headPos.z + forward.z * 0.55
    );
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
      // Calculate velocity vector
      const instantVx = (worldPos.x - hand.prevPosition.x) / dt;
      const instantVy = (worldPos.y - hand.prevPosition.y) / dt;
      const instantVz = (worldPos.z - hand.prevPosition.z) / dt;

      // Exponential moving average for velocity smoothing
      const alpha = 0.55;
      hand.velocity.x = hand.velocity.x * (1 - alpha) + instantVx * alpha;
      hand.velocity.y = hand.velocity.y * (1 - alpha) + instantVy * alpha;
      hand.velocity.z = hand.velocity.z * (1 - alpha) + instantVz * alpha;
    }

    hand.prevPosition.copy(worldPos);
    hand.position.copy(worldPos);
  }

  /**
   * Trigger native WebXR haptic pulse on controller
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
        // Safe fallback if browser restricts actuator
      }
    }
  }

  /**
   * Trigger haptics on both hands (e.g. for laser hit)
   */
  public pulseBothHaptics(intensity: number, durationMs: number) {
    this.pulseHaptic('left', intensity, durationMs);
    this.pulseHaptic('right', intensity, durationMs);
  }

  /**
   * Emit explosion particles from hit position
   */
  public emitHitSparks(position: THREE.Vector3, hexColor: string, count = 16, isPower = false) {
    const color = new THREE.Color(hexColor);
    const speedBase = isPower ? 3.5 : 2.2;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextParticleIdx];
      this.nextParticleIdx = (this.nextParticleIdx + 1) % VrEngine.MAX_PARTICLES;

      p.active = true;
      p.life = 0;
      p.maxLife = isPower ? 0.45 : 0.32;
      p.color.copy(color);
      p.size = isPower ? 0.045 : 0.028;
      p.position.copy(position);

      // Random 3D spherical direction
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
   * 140° Front-Dome Cross-Screen Spawner
   */
  private spawnTarget(timeMs: number) {
    const profile = DIFFICULTY_PROFILES[this.difficulty];
    const maxTargets = profile.maxConcurrentTargets;

    const currentTargetCount = this.blitzOrbs.length + this.voltNodes.length;
    if (currentTargetCount >= maxTargets) return;

    // Pick random anchor inside reachable strike plane
    const strikeY = THREE.MathUtils.lerp(
      this.calibration.strikeMinY + 0.05,
      this.calibration.strikeMaxY - 0.05,
      Math.random()
    );
    const strikeX = (Math.random() - 0.5) * 2 * (this.calibration.strikeHalfWidth * 0.85);
    const strikeZ = this.calibration.strikeZ; // ~ -0.55m

    const anchor = new THREE.Vector3(strikeX, strikeY, strikeZ);

    // 140° front arc perimeter (radius = 1.6m)
    // Never spawn behind the player: arc angle is between -70° and +70° from forward (-Z)
    const arcHalfRad = (70 * Math.PI) / 180;
    const entryAngle = (Math.random() - 0.5) * 2 * arcHalfRad;
    const spawnRadius = 1.6;

    const origin = new THREE.Vector3(
      Math.sin(entryAngle) * spawnRadius,
      strikeY + (Math.random() - 0.5) * 0.4,
      -Math.cos(entryAngle) * spawnRadius
    );

    // Trajectory continues through anchor to the opposite side of the dome
    const dir = new THREE.Vector3().subVectors(anchor, origin).normalize();
    const totalDistance = spawnRadius * 2.1;
    const exit = new THREE.Vector3().copy(origin).addScaledVector(dir, totalDistance);

    // Decide kind: Blitz Orb vs Volt Node
    const canSpawnVolt = this.voltNodes.length < GAME_TUNING.MAX_CONCURRENT_VOLT_NODES;
    const isVolt = canSpawnVolt && Math.random() < 0.22 && this.stats.pulseHits >= 3;

    if (isVolt) {
      // Volt Node (Gold)
      const duration = THREE.MathUtils.randFloat(
        profile.voltCrossDuration.min,
        profile.voltCrossDuration.max
      );
      this.voltNodes.push({
        id: `vr-volt-${Date.now()}-${Math.random()}`,
        kind: 'volt_node',
        origin,
        targetAnchor: anchor,
        exit,
        currentPos: origin.clone(),
        velocity: dir.clone().multiplyScalar((totalDistance / duration) * 1000),
        radius: 0.13,
        duration,
        elapsed: 0,
        telegraphTime: GAME_TUNING.ORB_TELEGRAPH_MS,
        holdProgress: 0,
        holdDurationMs: profile.voltHoldDurationMs || GAME_TUNING.VOLT_HOLD_DURATION_MS,
        isHeld: false,
        heldHand: null,
        isBurst: false,
        isMissed: false,
      });
    } else {
      // Blitz Orb (Cyan or Magenta)
      const color: 'cyan' | 'magenta' = this.orbCounter % 2 === 0 ? 'cyan' : 'magenta';
      this.orbCounter++;

      const duration = THREE.MathUtils.randFloat(
        profile.orbCrossDuration.min,
        profile.orbCrossDuration.max
      );

      this.blitzOrbs.push({
        id: `vr-orb-${Date.now()}-${Math.random()}`,
        kind: 'blitz_orb',
        color,
        origin,
        targetAnchor: anchor,
        exit,
        currentPos: origin.clone(),
        velocity: dir.clone().multiplyScalar((totalDistance / duration) * 1000),
        radius: 0.12,
        duration,
        elapsed: 0,
        telegraphTime: GAME_TUNING.ORB_TELEGRAPH_MS,
        isHit: false,
        isPower: false,
        isMissed: false,
        inStrikeZone: false,
      });
    }

    // Schedule next spawn
    const interval = THREE.MathUtils.lerp(
      profile.spawnIntervalBaseMs,
      profile.spawnIntervalFloorMs,
      Math.min(1.0, this.stats.combo / 18)
    );
    this.nextTargetSpawnTime = timeMs + interval;
  }

  /**
   * Spawn incoming Laser Barrier (Duck/Squat or Lean)
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
    const startZ = -3.8;
    const targetZ = 0.8;

    this.laserBarriers.push({
      id: `vr-laser-${Date.now()}`,
      kind: 'laser_barrier',
      orientation,
      currentZ: startZ,
      startZ,
      targetZ,
      speed,
      elapsed: 0,
      warningDuration: 1000,
      active: true,
      hasCollided: false,
      isDodged: false,
      barY: this.calibration.headY - 0.12, // Overhead bar for squatting
      beamX: orientation === 'vertical_left' ? -0.42 : orientation === 'vertical_right' ? 0.42 : 0,
      width: orientation === 'horizontal_squat' ? 1.6 : 0.45,
      height: orientation === 'horizontal_squat' ? 0.08 : 1.4,
    });

    soundEngine.playLaserWarning();

    // Schedule next laser in 9 - 14 seconds
    this.nextLaserSpawnTime = timeMs + THREE.MathUtils.randFloat(9000, 14000);
  }

  /**
   * Main imperative simulation step called inside R3F useFrame
   */
  public update(deltaSeconds: number, camera: THREE.Camera, nowMs: number) {
    const dtMs = deltaSeconds * 1000;

    // 1. Update Particles Pool
    for (let i = 0; i < VrEngine.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += deltaSeconds;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.position.set(0, -999, 0);
      } else {
        p.position.addScaledVector(p.velocity, deltaSeconds);
        p.velocity.y -= 3.2 * deltaSeconds; // Gravity
      }
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
        this.nextLaserSpawnTime = nowMs + 8000;
        this.onStateChange?.(this.state);
        this.onHudDirty?.();
      }
      return;
    }

    if (this.state !== 'playing') {
      return;
    }

    // Handle Game Mode Timers
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

    // Burned calories estimation (~8.5 kcal per minute of intense VR shadowboxing)
    this.stats.caloriesBurned = Math.floor((this.elapsedTime / 60) * 8.5);

    // Overdrive decay if not in active streak
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
      this.spawnTarget(nowMs);
    }
    if (nowMs >= this.nextLaserSpawnTime) {
      this.spawnLaserBarrier(nowMs);
    }

    // 3. Update Blitz Orbs
    for (let i = this.blitzOrbs.length - 1; i >= 0; i--) {
      const orb = this.blitzOrbs[i];
      orb.elapsed += dtMs;

      // Telegraph phase: glowing entry ring before moving
      if (orb.elapsed < orb.telegraphTime) {
        orb.currentPos.copy(orb.origin);
        continue;
      }

      const moveElapsed = orb.elapsed - orb.telegraphTime;
      const moveDuration = orb.duration;

      // Reach-Zone Brake check
      const distToStrike = Math.abs(orb.currentPos.z - this.calibration.strikeZ);
      const distToAnchor = orb.currentPos.distanceTo(orb.targetAnchor);
      const insideReachZone = distToStrike < 0.22 && distToAnchor < 0.40;
      orb.inStrikeZone = insideReachZone;

      // Traversal progress (0..1)
      let progress = moveElapsed / moveDuration;
      if (insideReachZone) {
        // Slowdown factor: 0.75x inside strike zone
        progress = Math.min(1.0, progress * GAME_TUNING.REACH_ZONE_SPEED_FACTOR + 0.05);
      }

      // Linear motion from origin through anchor to exit
      orb.currentPos.lerpVectors(orb.origin, orb.exit, progress);

      // Check collision against left and right fist positions
      const hitRadius = orb.radius * GAME_TUNING.ORB_HITBOX_MULTIPLIER;
      let hitByHand: VrHandInfo | null = null;

      // Left fist punch check
      if (this.hands.left.active && this.hands.left.position.distanceTo(orb.currentPos) <= hitRadius) {
        hitByHand = this.hands.left;
      } else if (
        this.hands.right.active &&
        this.hands.right.position.distanceTo(orb.currentPos) <= hitRadius
      ) {
        hitByHand = this.hands.right;
      }

      if (hitByHand) {
        orb.isHit = true;
        this.stats.totalStrikesAttempted++;
        this.stats.pulseHits++;

        // Calculate 3D punch speed
        const punchSpeed = hitByHand.velocity.length();
        const isPower = punchSpeed >= 2.2;
        if (isPower) {
          this.stats.powerHits++;
        }

        // Combo increment
        this.stats.combo++;
        if (this.stats.combo > this.stats.maxCombo) {
          this.stats.maxCombo = this.stats.combo;
        }

        // Score award
        let points = isPower ? 250 : 100;
        points *= Math.min(this.stats.combo, 10);
        // Bonus for counter-punching opposing orb flight direction
        const dotDirection = hitByHand.velocity.clone().normalize().dot(orb.velocity.clone().normalize());
        if (dotDirection < -0.3) {
          points += 50; // Counter-punch bonus
        }
        this.stats.score += points;

        // Build overdrive
        this.stats.overdrive = Math.min(100, this.stats.overdrive + (isPower ? 8 : 4));
        if (this.stats.overdrive >= 100) {
          this.stats.isOverdrive = true;
        }

        // Haptic feedback & audio
        const hapticIntensity = isPower ? 0.95 : 0.55;
        const hapticDuration = isPower ? 110 : 60;
        this.pulseHaptic(hitByHand.handedness, hapticIntensity, hapticDuration);
        soundEngine.playPunch(isPower, this.stats.combo);

        // Visual effects
        this.emitHitSparks(
          orb.currentPos,
          orb.color === 'cyan' ? '#00f0ff' : '#ff0077',
          isPower ? 24 : 14,
          isPower
        );

        this.blitzOrbs.splice(i, 1);
        this.onHudDirty?.();
        continue;
      }

      // Missed / Escaped check
      if (progress >= 1.0) {
        orb.isMissed = true;
        this.stats.combo = 0; // combo break on miss
        this.blitzOrbs.splice(i, 1);
        this.onHudDirty?.();
      }
    }

    // 4. Update Volt Nodes (Gravity Brake, sticky hysteresis, charge & burst)
    for (let i = this.voltNodes.length - 1; i >= 0; i--) {
      const node = this.voltNodes[i];
      node.elapsed += dtMs;

      if (node.elapsed < node.telegraphTime) {
        node.currentPos.copy(node.origin);
        continue;
      }

      // Hysteresis grab distance check
      const grabRadius = node.radius * GAME_TUNING.VOLT_GRAB_RADIUS_MULT;
      const maintainRadius = node.radius * GAME_TUNING.VOLT_MAINTAIN_RADIUS_MULT;

      let touchingHand: VrHandInfo | null = null;

      if (node.isHeld && node.heldHand) {
        // Sticky maintain radius once locked on
        const hand = this.hands[node.heldHand];
        if (hand.active && hand.position.distanceTo(node.currentPos) <= maintainRadius) {
          touchingHand = hand;
        }
      } else {
        // Initial grab radius check
        if (this.hands.left.active && this.hands.left.position.distanceTo(node.currentPos) <= grabRadius) {
          touchingHand = this.hands.left;
        } else if (
          this.hands.right.active &&
          this.hands.right.position.distanceTo(node.currentPos) <= grabRadius
        ) {
          touchingHand = this.hands.right;
        }
      }

      if (touchingHand) {
        node.isHeld = true;
        node.heldHand = touchingHand.handedness;

        // Gravity brake slows node down to 0.30x
        const speedMult = GAME_TUNING.VOLT_HELD_SPEED_MULTIPLIER;
        node.currentPos.addScaledVector(node.velocity, (deltaSeconds * speedMult));

        // Charge accumulation
        node.holdProgress = Math.min(1.0, node.holdProgress + dtMs / node.holdDurationMs);

        // Continuous light haptic hum every ~80ms
        if (nowMs - touchingHand.lastVoltPulseTime >= 80) {
          touchingHand.lastVoltPulseTime = nowMs;
          this.pulseHaptic(touchingHand.handedness, 0.22, 35);
        }

        soundEngine.startSolarCharge(node.holdProgress);

        // Burst check at 100% hold
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
          this.emitHitSparks(node.currentPos, '#ffd700', 30, true);

          this.voltNodes.splice(i, 1);
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
        node.holdProgress = Math.max(
          0,
          node.holdProgress - (dtMs / node.holdDurationMs) * GAME_TUNING.VOLT_CHARGE_DECAY_RATE
        );

        // Normal travel speed
        node.currentPos.addScaledVector(node.velocity, deltaSeconds);
      }

      // Exit screen check
      if (node.currentPos.z > 1.2 || node.currentPos.distanceTo(node.origin) > 4.0) {
        node.isMissed = true;
        if (node.isHeld) {
          soundEngine.stopSolarCharge();
        }
        this.voltNodes.splice(i, 1);
        this.onHudDirty?.();
      }
    }

    // 5. Update Laser Barriers (Squat / Lean check against headset camera.position)
    const headPos = camera.position;
    for (let i = this.laserBarriers.length - 1; i >= 0; i--) {
      const laser = this.laserBarriers[i];
      laser.elapsed += dtMs;
      laser.currentZ += laser.speed * deltaSeconds;

      // Crossing active player collision zone (z between -0.30m and +0.30m)
      if (laser.currentZ >= -0.30 && laser.currentZ <= 0.30 && !laser.hasCollided && !laser.isDodged) {
        let isHit = false;

        if (laser.orientation === 'horizontal_squat') {
          // Player must duck/squat below bar height
          if (headPos.y > this.calibration.headY - 0.16) {
            isHit = true;
          }
        } else if (laser.orientation === 'vertical_left') {
          // Beam on left side: player must lean right (x > -0.15)
          if (headPos.x < -0.15) {
            isHit = true;
          }
        } else if (laser.orientation === 'vertical_right') {
          // Beam on right side: player must lean left (x < 0.15)
          if (headPos.x > 0.15) {
            isHit = true;
          }
        }

        if (isHit) {
          laser.hasCollided = true;
          this.stats.lasersHit++;
          this.stats.combo = 0; // Break combo
          this.stats.score = Math.max(0, this.stats.score - 100);

          this.pulseBothHaptics(0.75, 160);
          soundEngine.playLaserHit();
          this.onHudDirty?.();
        } else {
          // Successfully dodged while crossing
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

      // Barrier passed player completely
      if (laser.currentZ > laser.targetZ) {
        this.laserBarriers.splice(i, 1);
      }
    }
  }

  public resetSession() {
    this.startSession(this.mode, this.difficulty);
  }
}

export const vrEngine = new VrEngine();
