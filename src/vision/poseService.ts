import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Landmark3D } from '../types/game';
import { mockPoseProvider } from './mockPoseProvider';
import { GameEngine } from '../engine/gameEngine';

export type PoseCallback = (landmarks: Landmark3D[] | null) => void;

class PoseService {
  private landmarker: PoseLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isRunning: boolean = false;
  private callbacks: Set<PoseCallback> = new Set();
  private lastVideoTime = -1;
  private animationFrameId: number | null = null;
  private isInitializing: boolean = false;
  public isCameraReady: boolean = false;
  public errorMessage: string | null = null;

  public subscribe(cb: PoseCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  public async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    if (this.isInitializing) return false;
    this.isInitializing = true;
    this.video = videoElement;
    this.errorMessage = null;

    // If mock mode is explicitly forced via URL or settings
    if (mockPoseProvider.enabled) {
      this.isCameraReady = true;
      this.isInitializing = false;
      this.startLoop();
      return true;
    }

    try {
      // 1. Request Webcam Permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.stream = stream;
      this.video.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (!this.video) return resolve();
        this.video.onloadedmetadata = () => {
          this.video?.play().then(() => resolve()).catch(() => resolve());
        };
      });

      // 2. Initialize MediaPipe PoseLandmarker
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isCameraReady = true;
      this.isInitializing = false;
      this.startLoop();
      return true;
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : String(err);
      console.warn('PoseService initialization note (switching to Mock Provider capability):', errorStr);
      this.errorMessage = errorStr;
      this.isInitializing = false;

      // Auto-enable mock pose provider so the app remains fully functional without a camera!
      mockPoseProvider.enabled = true;
      this.isCameraReady = true;
      this.startLoop();
      return false;
    }
  }

  public startLoop(gameEngine?: GameEngine) {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = () => {
      if (!this.isRunning) return;

      let resultLandmarks: Landmark3D[] | null = null;

      // 1. If Mock Mode is active
      if (mockPoseProvider.enabled) {
        resultLandmarks = mockPoseProvider.generateLandmarks(gameEngine);
      } else if (this.landmarker && this.video && this.video.readyState >= 2) {
        // 2. Real Camera Inference
        const currentTime = this.video.currentTime;
        if (currentTime !== this.lastVideoTime) {
          this.lastVideoTime = currentTime;
          try {
            const result = this.landmarker.detectForVideo(this.video, performance.now());
            if (result.landmarks && result.landmarks.length > 0) {
              const raw = result.landmarks[0];
              // Mirror horizontal coordinate (1 - x) to match natural mirror reflection
              resultLandmarks = raw.map((lm) => ({
                x: 1 - lm.x,
                y: lm.y,
                z: lm.z,
                visibility: lm.visibility,
              }));
            }
          } catch (e) {
            console.error('Inference error:', e);
          }
        }
      }

      // Notify all subscribers
      for (const cb of this.callbacks) {
        cb(resultLandmarks);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }
}

export const poseService = new PoseService();
