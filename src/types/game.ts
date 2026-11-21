export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type PostureType = 'standing' | 'seated' | 'uncalibrated';
export type GameMode = 'quick' | 'endurance' | 'endless';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type CameraMode = 'dimmed' | 'silhouette' | 'hidden';

export type GameState = 
  | 'idle' 
  | 'calibrating' 
  | 'countdown' 
  | 'playing' 
  | 'paused' 
  | 'game_over'
  | 'tutorial';

export type TutorialStep = 'intro' | 'strike' | 'hold' | 'dodge' | 'outro';

export interface SessionRecord {
  id: string;
  date: string;
  mode: GameMode;
  difficulty: DifficultyLevel;
  posture: PostureType;
  score: number;
  rank: string;
  caloriesBurned: number;
  durationSeconds: number;
  pulseHits: number;
  powerHits: number;
  solarHolds: number;
  lasersDodged: number;
  lasersHit: number;
  maxCombo: number;
}

export interface CalibrationData {
  shoulderCenter: Point2D;
  shoulderWidth: number;
  torsoHeight: number;
  headY: number;
  reachRadiusX: number;
  reachRadiusY: number;
  posture: PostureType;
  calibratedAt: number;
}

export type TargetKind = 'pulse_orb' | 'solar_node' | 'laser_barrier';

export interface BaseTarget {
  id: string;
  kind: TargetKind;
  createdAt: number;
  spawnTime: number;
}

export interface PulseOrbTarget extends BaseTarget {
  kind: 'pulse_orb';
  targetPos: Point2D;      // Calibrated reachable anchor coordinate
  originPos: Point2D;      // Entry coordinate (spawnX, spawnY)
  currentPos: Point2D;
  scale: number;           // 1.0 (approaching depth / scale)
  timingRingScale: number; // Retained for compatibility
  duration: number;        // Cross-screen traversal time in ms (1600 - 2200ms)
  radius: number;          // Base radius in pixels (~46 - 50px)
  color: string;
  isHit: boolean;
  powerHit: boolean;
  missed: boolean;

  // 360° Cross-Screen Trajectory Fields
  spawnX: number;
  spawnY: number;
  exitX: number;
  exitY: number;
  vx: number;              // Normalized travel velocity vector X
  vy: number;              // Normalized travel velocity vector Y
  telegraphRemaining: number; // e.g. 450ms edge warning before entering screen
  telegraphDuration: number;  // Initial telegraph time
  arcOffset: number;       // Perpendicular curve amplitude for trajectory variety
  escaped: boolean;        // true if target crossed opposite border without being hit
  progress: number;        // 0..1 traversal progress across screen
}

export interface SolarNodeTarget extends BaseTarget {
  kind: 'solar_node';
  centerPos: Point2D;      // Anchor base position
  currentPos: Point2D;
  amplitude: number;       // Perpendicular sine sway amplitude
  frequency: number;       // Sine sway frequency
  holdDurationRequired: number; // 600ms
  currentHoldTime: number;      // 0..600ms
  radius: number;
  activeHand: 'left' | 'right' | null;
  isCompleted: boolean;
  lifetime: number;             // Total crossing duration (3400 - 4200ms)
  missed: boolean;

  // 360° Cross-Screen Trajectory Fields
  spawnX: number;
  spawnY: number;
  exitX: number;
  exitY: number;
  vx: number;
  vy: number;
  telegraphRemaining: number;
  telegraphDuration: number;
  arcOffset: number;
  escaped: boolean;
  progress: number;
}

export type BlitzOrbTarget = PulseOrbTarget;
export type VoltNodeTarget = SolarNodeTarget;

export interface LaserBarrierTarget extends BaseTarget {
  kind: 'laser_barrier';
  orientation: 'horizontal_squat' | 'vertical_left' | 'vertical_right';
  warningDuration: number;      // 1500ms telegraph warning
  activeDuration: number;       // 800ms dangerous active beam
  isDodged: boolean;
  hasCollided: boolean;
  damageApplied: boolean;
}

export type GameTarget = PulseOrbTarget | SolarNodeTarget | LaserBarrierTarget;

export interface PlayerStats {
  score: number;
  combo: number;
  maxCombo: number;
  pulseHits: number;
  powerHits: number;
  solarHolds: number;
  lasersDodged: number;
  lasersHit: number;
  caloriesBurned: number;
  totalStrikesAttempted: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
  scale: number;
}
