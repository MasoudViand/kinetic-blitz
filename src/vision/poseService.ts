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
  private isStartingCamera: boolean = false;
  private isModelLoading: boolean = false;
  public isCameraReady: boolean = false;
  public cameraPermissionDenied: boolean = false;
  public errorMessage: string | null = null;

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public isCameraActive(): boolean {
    return !!(this.stream && this.stream.active && this.isRunning);
  }

  public subscribe(cb: PoseCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  /**
   * Pre-warms the MediaPipe PoseLandmarker model in memory without requesting camera access.
   * Can be called safely on startup to eliminate startup latency when the workout begins.
   */
  public async preloadModel(): Promise<void> {
    if (this.landmarker || this.isModelLoading) return;
    this.isModelLoading = true;

    try {
      const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const wasmPath = `${origin}${baseUrl}/wasm`;
      const modelPath = `${origin}${baseUrl}/models/pose_landmarker_lite.task`;

      const vision = await FilesetResolver.forVisionTasks(wasmPath);

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.log('[PoseService] MediaPipe PoseLandmarker model preloaded successfully.');
    } catch (err) {
      console.warn('[PoseService] Model preload note:', err);
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Starts the physical camera stream and activates the inference loop.
   * Only called during active gameplay, calibration, or phone TV sensor mode.
   */
  public async startCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    this.video = videoElement;
    this.errorMessage = null;

    // 1. If physical stream is already active and working, reuse it without prompting
    if (this.stream && this.stream.active) {
      this.isCameraReady = true;
      this.cameraPermissionDenied = false;
      this.startLoop();
      return true;
    }

    if (this.isStartingCamera) return false;
    this.isStartingCamera = true;

    // 2. Only bypass camera if mock mode is explicitly forced (e.g. ?mock=true)
    if (mockPoseProvider.isForced) {
      mockPoseProvider.enabled = true;
      this.isCameraReady = true;
      this.cameraPermissionDenied = false;
      this.isStartingCamera = false;
      this.startLoop();
      return true;
    }

    try {
      // 1. Ensure MediaPipe model is preloaded
      if (!this.landmarker) {
        await this.preloadModel();
      }

      // 2. Request Webcam Permission - asks every time camera is needed unless already granted
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.stream = stream;
      this.cameraPermissionDenied = false;
      if (this.video) {
        this.video.srcObject = stream;
        await new Promise<void>((resolve) => {
          if (!this.video) return resolve();
          this.video.onloadedmetadata = () => {
            this.video?.play().then(() => resolve()).catch(() => resolve());
          };
          if (this.video.readyState >= 1) {
            this.video.play().then(() => resolve()).catch(() => resolve());
          }
        });
      }

      this.isCameraReady = true;
      this.isStartingCamera = false;
      this.startLoop();
      return true;
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : String(err);
      console.warn('[PoseService] Camera start error:', errorStr);
      this.errorMessage = errorStr;
      this.isStartingCamera = false;
      this.isCameraReady = false;
      this.cameraPermissionDenied = true;
      // Do NOT permanently latch mockPoseProvider.enabled = true,
      // so next time camera is needed it will prompt getUserMedia again!
      return false;
    }
  }

  /**
   * Completely stops the physical camera hardware and turns off the webcam indicator light.
   * Preserves the loaded MediaPipe model in memory for instant resumption.
   */
  public stopCamera() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.isCameraReady = false;
    this.lastVideoTime = -1;
  }

  // Backwards compatibility aliases
  public async initialize(videoElement: HTMLVideoElement): Promise<boolean> {
    return this.startCamera(videoElement);
  }

  public stop() {
    this.stopCamera();
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

              // Correct for CSS object-cover on the <video> element so canvas coordinates
              // align pixel-for-pixel with the mirrored video on screen
              const vw = this.video.videoWidth || 1280;
              const vh = this.video.videoHeight || 720;
              const cw = this.video.clientWidth || window.innerWidth;
              const ch = this.video.clientHeight || window.innerHeight;

              const vAspect = vw / vh;
              const cAspect = cw / ch;

              let scale = 1;
              let offsetX = 0;
              let offsetY = 0;

              if (cAspect > vAspect) {
                // Container wider than video -> video fits width, crops top/bottom
                scale = cw / vw;
                const renderedH = vh * scale;
                offsetY = (ch - renderedH) / 2;
              } else {
                // Container narrower than video -> video fits height, crops left/right
                scale = ch / vh;
                const renderedW = vw * scale;
                offsetX = (cw - renderedW) / 2;
              }

              const renderedW = vw * scale;
              const renderedH = vh * scale;

              // Mirror horizontal coordinate (1 - x) to match CSS scale-x-[-1]
              resultLandmarks = raw.map((lm) => {
                const mirroredX = 1 - lm.x;
                const screenPxX = mirroredX * renderedW + offsetX;
                const screenPxY = lm.y * renderedH + offsetY;

                return {
                  x: Math.max(0, Math.min(1, screenPxX / cw)),
                  y: Math.max(0, Math.min(1, screenPxY / ch)),
                  z: lm.z,
                  visibility: lm.visibility,
                };
              });
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


}

export const poseService = new PoseService();
