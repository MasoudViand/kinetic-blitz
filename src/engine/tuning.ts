import { DifficultyLevel } from '../types/game';

export interface DifficultyProfile {
  orbCrossDuration: { min: number; max: number };
  orbCrossDurationFloor: number;
  voltCrossDuration: { min: number; max: number };
  voltHoldDurationMs: number;
  spawnIntervalBaseMs: number;
  spawnIntervalFloorMs: number;
  maxConcurrentTargets: number;
}

export const DIFFICULTY_PROFILES: Record<DifficultyLevel, DifficultyProfile> = {
  easy: {
    // Slower paced (former medium speed)
    orbCrossDuration: { min: 3400, max: 4200 },
    orbCrossDurationFloor: 2300,
    voltCrossDuration: { min: 7200, max: 8500 }, // Volts unchanged
    voltHoldDurationMs: 400,
    spawnIntervalBaseMs: 1700,
    spawnIntervalFloorMs: 950,
    maxConcurrentTargets: 3,
  },
  medium: {
    // Active / standard speed (former hard speed)
    orbCrossDuration: { min: 2900, max: 3600 },
    orbCrossDurationFloor: 2100,
    voltCrossDuration: { min: 6500, max: 8000 }, // Volts unchanged
    voltHoldDurationMs: 450,
    spawnIntervalBaseMs: 1450,
    spawnIntervalFloorMs: 850,
    maxConcurrentTargets: 3,
  },
  hard: {
    // Intense speed (adjusted faster & tighter than former hard)
    orbCrossDuration: { min: 2200, max: 2800 },
    orbCrossDurationFloor: 1600,
    voltCrossDuration: { min: 5800, max: 7000 }, // Volts unchanged
    voltHoldDurationMs: 500,
    spawnIntervalBaseMs: 1150,
    spawnIntervalFloorMs: 700,
    maxConcurrentTargets: 4,
  },
};

export const GAME_TUNING = {
  // Edge Telegraph
  ORB_TELEGRAPH_MS: 650, // 650ms edge warning before entering screen

  // Blitz Orb Crossing Durations & Physics (defaults to Medium profile)
  ORB_CROSS_DURATION_BASE: { min: 2900, max: 3600 },
  ORB_CROSS_DURATION_MIN_FLOOR: 2100, // hard cap even at max difficulty / Blitz Overdrive
  ORB_HITBOX_MULTIPLIER: 1.25, // generous strike forgiveness
  REACH_ZONE_SPEED_FACTOR: 0.75, // 25% slowdown while crossing inside calibrated reach box

  // Volt Node Crossing & Hold Physics (UNCHANGED)
  VOLT_CROSS_DURATION_BASE: { min: 6500, max: 8000 },
  VOLT_WAVE_AMPLITUDE_PX: 25, // subtle drift in pixels (approx 0.025-0.035 norm)
  VOLT_HOLD_DURATION_MS: 450, // 450ms hold requirement
  VOLT_GRAB_RADIUS_MULT: 1.35, // radius to initiate grab lock-on
  VOLT_MAINTAIN_RADIUS_MULT: 1.85, // wider sticky radius once locked on to absorb pose jitter
  VOLT_HELD_SPEED_MULTIPLIER: 0.30, // Gravity Brake: slows node by 70% while player is grabbing it
  VOLT_CHARGE_DECAY_RATE: 0.5, // charge drains smoothly at half-speed if hand leaves, never hard-resets to 0

  // Spawning & Concurrency Caps
  SPAWN_INTERVAL_BASE_MS: 1450, // ramps gently down to 850ms floor
  SPAWN_INTERVAL_FLOOR_MS: 850,
  MAX_CONCURRENT_TARGETS: 3,
  MAX_CONCURRENT_VOLT_NODES: 1,

  // Difficulty profile lookup helper
  getDifficultyProfile: (level: DifficultyLevel = 'medium'): DifficultyProfile => {
    return DIFFICULTY_PROFILES[level] || DIFFICULTY_PROFILES.medium;
  },
};
