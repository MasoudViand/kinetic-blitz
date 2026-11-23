import * as THREE from 'three';

export type VrPhase = 'CALIBRATING' | 'PLAYING' | 'PAUSED' | 'SUMMARY';
export type VrGameState = 'idle' | 'calibrating' | 'countdown' | 'playing' | 'paused' | 'game_over' | 'summary';
export type VrOrbTier = 'low' | 'mid' | 'high';

export interface VrHandInfo {
  handedness: 'left' | 'right';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  prevPosition: THREE.Vector3;
  active: boolean;
  inputSource: XRInputSource | null;
  lastHapticTime: number;
  lastVoltPulseTime: number;
}

export interface VrBlitzOrb {
  id: string;
  kind: 'blitz_orb';
  color: 'cyan' | 'magenta';
  tier: VrOrbTier;
  localPos: THREE.Vector3;
  worldPos: THREE.Vector3;
  spawnLocal: THREE.Vector3;
  targetLocal: THREE.Vector3;
  exitLocal: THREE.Vector3;
  controlLocal: THREE.Vector3;
  radius: number;
  approachDuration: number; // ms to reach z = -0.45m (Easy: 2600, Medium: 2000, Hard: 1500)
  totalDuration: number;    // total lifetime to z = +0.35m
  elapsed: number;          // ms since spawn
  isHit: boolean;
  isPower: boolean;
  isMissed: boolean;
  inStrikeZone: boolean;    // localZ >= -0.80m && localZ <= +0.10m
}

export interface VrVoltNode {
  id: string;
  kind: 'volt_node';
  localPos: THREE.Vector3;
  worldPos: THREE.Vector3;
  spawnLocal: THREE.Vector3;
  targetLocal: THREE.Vector3;
  exitLocal: THREE.Vector3;
  vzBase: number;           // base forward velocity in m/s
  vxBase: number;           // base lateral velocity in m/s
  radius: number;
  holdProgress: number;     // 0..1
  holdDurationMs: number;   // 450ms
  isHeld: boolean;
  heldHand: 'left' | 'right' | null;
  isBurst: boolean;
  isMissed: boolean;
}

export type VrLaserOrientation = 'horizontal_squat' | 'vertical_left' | 'vertical_right';

export interface VrLaserBarrier {
  id: string;
  kind: 'laser_barrier';
  orientation: VrLaserOrientation;
  localZ: number;           // starts at -5.5m, sweeps to +0.8m
  worldPos: THREE.Vector3;
  worldRotationY: number;   // aligned to forwardYaw
  speed: number;            // m/s
  elapsed: number;
  active: boolean;
  hasCollided: boolean;
  isDodged: boolean;
  barY: number;             // center Y of barrier
  beamX: number;            // lateral X of vertical beam
  width: number;
  height: number;
}

export type VrTarget = VrBlitzOrb | VrVoltNode | VrLaserBarrier;

export interface VrCalibration {
  playerOrigin: THREE.Vector3; // world X, 0, world Z
  headY: number;               // world camera Y
  forward: THREE.Vector3;      // normalized horizontal facing direction
  right: THREE.Vector3;        // normalized horizontal lateral direction
  forwardYaw: number;          // yaw angle in radians
  calibrated: boolean;
  headDriftDistance: number;   // horizontal distance from playerOrigin (meters)
  isDrifted: boolean;          // true when headDriftDistance > 0.40m
}

export interface VrStats {
  score: number;
  combo: number;
  maxCombo: number;
  pulseHits: number;
  powerHits: number;
  solarHolds: number;
  lasersDodged: number;
  lasersHit: number;
  caloriesBurned: number;
  overdrive: number;           // 0..100
  isOverdrive: boolean;
  totalStrikesAttempted: number;
}

export interface VrParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  active: boolean;
}
