import { Landmark3D } from '../types/game';

export interface CompactPosePacket {
  seq: number;
  t: number;
  lm: {
    [id: string]: [number, number, number]; // [x, y, visibility]
  };
  absent?: boolean;
}

export type PoseCallback = (landmarks: Landmark3D[] | null) => void;

/**
 * Key landmark indices serialized in compact packets:
 * 0: Nose
 * 11, 12: Shoulders
 * 13, 14: Elbows
 * 15, 16: Wrists
 * 17, 18: Pinkies
 * 19, 20: Index fingers
 * 23, 24: Hips
 * 25, 26: Knees
 * 27, 28: Ankles
 */
export const STREAMED_LANDMARK_IDS = [0, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 28];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * RemotePoseProvider
 * Implements the pose subscription interface on the TV side.
 * Ingests compact landmark JSON packets from the Phone via PeerJS DataChannel,
 * drops out-of-order packets via seq, reconstructs the standard 33-landmark array,
 * and performs lightweight 60 FPS lerp interpolation for silky-smooth motion.
 */
export class RemotePoseProvider {
  private callbacks: Set<PoseCallback> = new Set();
  private lastSeq: number = -1;
  private lastPacketTime: number = 0;
  private currentLandmarks: Landmark3D[] | null = null;
  private targetLandmarks: Landmark3D[] | null = null;
  private absenceTimeoutMs: number = 1000;
  private animFrameId: number | null = null;
  private isLoopRunning: boolean = false;

  public isPresent: boolean = false;
  public pingMs: number = 0;
  public fps: number = 0;
  private frameCount: number = 0;
  private lastFpsCalc: number = performance.now();

  constructor() {
    this.startInterpolationLoop();
  }

  public subscribe(cb: PoseCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  /**
   * Called whenever a compact pose packet arrives from the phone.
   */
  public onPacketReceived(packet: CompactPosePacket) {
    if (!packet || typeof packet !== 'object') return;

    // Drop stale out-of-order packets (handle seq ordering)
    if (packet.seq <= this.lastSeq && this.lastSeq - packet.seq < 10000) {
      return;
    }
    this.lastSeq = packet.seq;
    this.lastPacketTime = performance.now();

    // Calculate one-way latency approximation if clocks are roughly in sync
    if (packet.t && packet.t > 0) {
      const now = Date.now();
      const rawDiff = now - packet.t;
      if (rawDiff >= 0 && rawDiff < 500) {
        this.pingMs = Math.round(this.pingMs * 0.8 + rawDiff * 0.2);
      }
    }

    // Packet marks user as absent
    if (packet.absent || !packet.lm || Object.keys(packet.lm).length === 0) {
      this.isPresent = false;
      this.targetLandmarks = null;
      return;
    }

    this.isPresent = true;
    this.frameCount++;
    const nowPerf = performance.now();
    if (nowPerf - this.lastFpsCalc >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCalc = nowPerf;
    }

    // Reconstruct full 33-landmark array expected by postureDetector & gameEngine
    const reconstructed: Landmark3D[] = new Array(33);

    // 1. Fill streamed key landmarks
    for (const idStr of Object.keys(packet.lm)) {
      const id = parseInt(idStr, 10);
      const tuple = packet.lm[idStr];
      if (tuple && tuple.length >= 2) {
        reconstructed[id] = {
          x: tuple[0],
          y: tuple[1],
          z: 0.0,
          visibility: tuple[2] !== undefined ? tuple[2] : 0.9,
        };
      }
    }

    // 2. Synthesize missing landmarks for complete anatomical skeleton
    const nose = reconstructed[0] || { x: 0.5, y: 0.3, z: 0, visibility: 0 };
    const leftWrist = reconstructed[15] || { x: 0.35, y: 0.6, z: 0, visibility: 0 };
    const rightWrist = reconstructed[16] || { x: 0.65, y: 0.6, z: 0, visibility: 0 };
    const leftKnee = reconstructed[25] || { x: 0.42, y: 0.75, z: 0, visibility: 0 };
    const rightKnee = reconstructed[26] || { x: 0.58, y: 0.75, z: 0, visibility: 0 };

    // Fill face points (1-10) near nose
    for (let i = 1; i <= 10; i++) {
      if (!reconstructed[i]) {
        reconstructed[i] = {
          x: nose.x + (i % 2 === 0 ? 0.02 : -0.02),
          y: nose.y,
          z: 0,
          visibility: nose.visibility,
        };
      }
    }

    // Fill hands & finger knuckles (17-22) around wrists
    for (let i = 17; i <= 22; i++) {
      if (!reconstructed[i]) {
        const isLeft = i % 2 !== 0;
        const ref = isLeft ? leftWrist : rightWrist;
        reconstructed[i] = {
          x: ref.x,
          y: ref.y,
          z: 0,
          visibility: ref.visibility,
        };
      }
    }

    // Fill ankles and feet (27-32) below knees
    for (let i = 27; i <= 32; i++) {
      if (!reconstructed[i]) {
        const isLeft = i % 2 !== 0;
        const refKnee = isLeft ? leftKnee : rightKnee;
        reconstructed[i] = {
          x: refKnee.x,
          y: Math.min(0.98, refKnee.y + 0.18),
          z: 0,
          visibility: refKnee.visibility,
        };
      }
    }

    this.targetLandmarks = reconstructed;

    // If first frame, snap current directly to target
    if (!this.currentLandmarks) {
      this.currentLandmarks = reconstructed.map((lm) => ({ ...lm }));
    }
  }

  /**
   * Smooth 60 FPS interpolation loop.
   * Lerps current coordinates toward target coordinates so 30 FPS phone inference
   * renders without jitter on 60 FPS TV displays.
   */
  private startInterpolationLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    const loop = () => {
      const now = performance.now();

      // Check for packet timeout (> 1000ms with no packet marks player as absent)
      if (this.lastPacketTime > 0 && now - this.lastPacketTime > this.absenceTimeoutMs) {
        if (this.isPresent) {
          this.isPresent = false;
          this.currentLandmarks = null;
          this.targetLandmarks = null;
          this.callbacks.forEach((cb) => cb(null));
        }
      } else if (this.currentLandmarks && this.targetLandmarks) {
        // Lerp factor ~0.45: fast enough for snappy punch detection, smooth enough to eliminate jitter
        const t = 0.45;
        for (let i = 0; i < 33; i++) {
          const curr = this.currentLandmarks[i];
          const tgt = this.targetLandmarks[i];
          if (curr && tgt) {
            curr.x = lerp(curr.x, tgt.x, t);
            curr.y = lerp(curr.y, tgt.y, t);
            curr.z = lerp(curr.z, tgt.z, t);
            curr.visibility = tgt.visibility;
          }
        }

        // Notify subscribers with the latest smoothed landmarks
        this.callbacks.forEach((cb) => cb(this.currentLandmarks));
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  public getLandmarks(): Landmark3D[] | null {
    return this.isPresent ? this.currentLandmarks : null;
  }

  public reset() {
    this.lastSeq = -1;
    this.lastPacketTime = 0;
    this.isPresent = false;
    this.currentLandmarks = null;
    this.targetLandmarks = null;
    this.callbacks.forEach((cb) => cb(null));
  }

  public destroy() {
    this.reset();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isLoopRunning = false;
    this.callbacks.clear();
  }
}

export const remotePoseProvider = new RemotePoseProvider();
if (typeof window !== 'undefined') {
  (window as unknown as { remotePoseProvider: RemotePoseProvider }).remotePoseProvider = remotePoseProvider;
}
