import * as THREE from 'three';

export type VrGameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'game_over';

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
  origin: THREE.Vector3;
  targetAnchor: THREE.Vector3;
  exit: THREE.Vector3;
  currentPos: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  duration: number; // total cross duration in ms
  elapsed: number;  // ms since spawn
  telegraphTime: number; // 650ms entry warning
  isHit: boolean;
  isPower: boolean;
  isMissed: boolean;
  inStrikeZone: boolean;
}

export interface VrVoltNode {
  id: string;
  kind: 'volt_node';
  origin: THREE.Vector3;
  targetAnchor: THREE.Vector3;
  exit: THREE.Vector3;
  currentPos: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  duration: number;
  elapsed: number;
  telegraphTime: number;
  holdProgress: number; // 0..1
  holdDurationMs: number; // 450ms
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
  currentZ: number;
  startZ: number;
  targetZ: number;
  speed: number; // m/s
  elapsed: number;
  warningDuration: number; // ms
  active: boolean;
  hasCollided: boolean;
  isDodged: boolean;
  barY: number; // headY - 0.12 for squat
  beamX: number; // -0.45 or +0.45 for vertical
  width: number;
  height: number;
}

export type VrTarget = VrBlitzOrb | VrVoltNode | VrLaserBarrier;

export interface VrCalibration {
  headY: number;
  headPosition: THREE.Vector3;
  forward: THREE.Vector3;
  strikeCenter: THREE.Vector3;
  strikeHalfWidth: number;
  strikeMinY: number;
  strikeMaxY: number;
  strikeZ: number;
  calibrated: boolean;
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
  overdrive: number; // 0..100
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
