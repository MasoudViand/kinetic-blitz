import Peer, { DataConnection } from 'peerjs';
import { GameMode, GameState, DifficultyLevel, PostureType, Landmark3D } from '../types/game';
import { CompactPosePacket, STREAMED_LANDMARK_IDS, remotePoseProvider } from '../vision/remotePoseProvider';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type TvControlCommand =
  | { type: 'START_GAME'; mode: GameMode; difficulty: DifficultyLevel }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTART' }
  | { type: 'EXIT_TO_MENU' }
  | { type: 'SET_POSTURE'; posture: PostureType }
  | { type: 'RECALIBRATE' }
  | { type: 'START_TUTORIAL' }
  | { type: 'SKIP_TUTORIAL' };

export interface TvStateUpdate {
  phase: GameState;
  score: number;
  combo: number;
  maxCombo: number;
  timeRemaining: number;
  caloriesBurned: number;
  postureMode: PostureType;
  difficulty: DifficultyLevel;
  mode: GameMode;
  isPresent: boolean;
  tvFps?: number;
  summary?: {
    score: number;
    rank: string;
    pulseHits: number;
    solarHolds: number;
    lasersDodged: number;
    maxCombo: number;
    caloriesBurned: number;
  };
}

export type CastConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Generates an unambiguous 4-character room code.
 */
export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return result;
}

/**
 * Sanitizes user code input (strips invalid characters and enforces 4 chars).
 */
export function sanitizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '')
    .slice(0, 4);
}

export function getPeerIdForCode(code: string): string {
  return `kb-tv-${sanitizeRoomCode(code)}`;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

/**
 * TV Host Controller: Registers kb-tv-${CODE} and accepts incoming Pose and Control DataConnections.
 */
export class TvReceiverSession {
  private peer: Peer | null = null;
  private poseConn: DataConnection | null = null;
  private controlConn: DataConnection | null = null;
  public roomCode: string;

  public onClientConnected?: () => void;
  public onClientDisconnected?: () => void;
  public onControlCommandReceived?: (cmd: TvControlCommand) => void;
  public onError?: (err: Error) => void;

  constructor(initialCode?: string) {
    this.roomCode = initialCode ? sanitizeRoomCode(initialCode) : generateRoomCode();
  }

  public start(onReady?: (code: string) => void) {
    this.destroy();

    const peerId = getPeerIdForCode(this.roomCode);
    const peer = new Peer(peerId, {
      debug: 1,
    });
    this.peer = peer;

    peer.on('open', (id) => {
      console.log('[TvReceiver] Registered with Peer ID:', id);
      onReady?.(this.roomCode);
    });

    peer.on('connection', (conn) => {
      console.log(`[TvReceiver] Incoming DataConnection (${conn.label || 'unlabeled'})`);

      conn.on('open', () => {
        console.log(`[TvReceiver] DataConnection ${conn.label} opened`);
        if (conn.label === 'pose') {
          this.poseConn = conn;
        } else {
          this.controlConn = conn;
        }
        this.onClientConnected?.();
      });

      conn.on('data', (data) => {
        if (!data || typeof data !== 'object') return;

        // Route pose packets
        if ('seq' in data && 'lm' in data) {
          remotePoseProvider.onPacketReceived(data as CompactPosePacket);
          return;
        }

        // Route control commands
        if ('type' in data) {
          this.onControlCommandReceived?.(data as TvControlCommand);
        }
      });

      conn.on('close', () => {
        console.log(`[TvReceiver] DataConnection ${conn.label} closed`);
        if (conn === this.controlConn) {
          this.controlConn = null;
          this.onClientDisconnected?.();
        } else if (conn === this.poseConn) {
          this.poseConn = null;
        }
      });

      conn.on('error', (err) => {
        console.warn(`[TvReceiver] DataConnection ${conn.label} error:`, err);
      });
    });

    peer.on('error', (err) => {
      console.warn('[TvReceiver] Peer error:', err);
      if (err.type === 'unavailable-id') {
        // ID taken on public broker, retry with a fresh random code
        this.roomCode = generateRoomCode();
        this.start(onReady);
      } else {
        this.onError?.(err);
      }
    });
  }

  /**
   * Broadcast lightweight game state update back to the phone.
   */
  public sendStateUpdate(update: TvStateUpdate) {
    if (this.controlConn && this.controlConn.open) {
      try {
        this.controlConn.send(update);
      } catch {
        // Non-blocking
      }
    }
  }

  public destroy() {
    try {
      this.poseConn?.close();
      this.controlConn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore
    }
    this.poseConn = null;
    this.controlConn = null;
    this.peer = null;
    remotePoseProvider.reset();
  }
}

/**
 * Phone Sender Controller:
 * Streams compact Pose JSON over an unreliable/unordered DataConnection
 * and sends game commands over a reliable DataConnection.
 */
export class PhoneSenderSession {
  private peer: Peer | null = null;
  private poseConn: DataConnection | null = null;
  private controlConn: DataConnection | null = null;
  private wakeLock: WakeLockSentinelLike | null = null;
  private seq: number = 0;

  public status: CastConnectionStatus = 'disconnected';
  public connectedCode: string | null = null;

  public onStatusChange?: (status: CastConnectionStatus, code?: string) => void;
  public onStateUpdate?: (update: TvStateUpdate) => void;
  public onError?: (err: Error) => void;

  private async acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinelLike> } }).wakeLock) {
        this.wakeLock = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinelLike> } }).wakeLock.request('screen');
        this.wakeLock.addEventListener?.('release', () => {
          this.wakeLock = null;
        });
      }
    } catch (e) {
      console.warn('[PhoneSender] Screen Wake Lock not available:', e);
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  public async connectToTv(code: string): Promise<boolean> {
    const cleanCode = sanitizeRoomCode(code);
    if (cleanCode.length !== 4) {
      throw new Error('Please enter a valid 4-character TV code.');
    }

    this.disconnect();
    this.status = 'connecting';
    this.onStatusChange?.('connecting', cleanCode);

    return new Promise((resolve, reject) => {
      try {
        const peer = new Peer({
          debug: 1,
        });
        this.peer = peer;

        const timeoutId = setTimeout(() => {
          if (this.status !== 'connected') {
            this.disconnect();
            const timeoutErr = new Error('Connection to TV timed out. Please check the room code.');
            this.onError?.(timeoutErr);
            reject(timeoutErr);
          }
        }, 15000);

        peer.on('open', () => {
          const targetPeerId = getPeerIdForCode(cleanCode);
          console.log('[PhoneSender] Connecting to TV host:', targetPeerId);

          // 1. Reliable Control Channel (Commands & Telemetry)
          const control = peer.connect(targetPeerId, {
            label: 'control',
            reliable: true,
          });
          this.controlConn = control;

          // 2. Unreliable, Unordered UDP-Style Pose Channel (Drops stale frames instead of lag spikes)
          const pose = peer.connect(targetPeerId, {
            label: 'pose',
            reliable: false,
          });
          this.poseConn = pose;

          control.on('open', () => {
            console.log('[PhoneSender] Control DataConnection opened');
            clearTimeout(timeoutId);
            this.status = 'connected';
            this.connectedCode = cleanCode;
            this.acquireWakeLock();
            this.onStatusChange?.('connected', cleanCode);
            resolve(true);
          });

          control.on('data', (data) => {
            if (data && typeof data === 'object') {
              this.onStateUpdate?.(data as TvStateUpdate);
            }
          });

          control.on('close', () => {
            console.log('[PhoneSender] Control DataConnection closed');
            this.disconnect();
          });

          control.on('error', (err) => {
            console.warn('[PhoneSender] Control channel error:', err);
          });

          pose.on('error', (err) => {
            console.warn('[PhoneSender] Pose channel error:', err);
          });
        });

        peer.on('error', (err) => {
          console.warn('[PhoneSender] Peer error:', err);
          clearTimeout(timeoutId);
          this.status = 'error';
          this.onStatusChange?.('error');
          this.onError?.(err);
          reject(err);
        });
      } catch (err) {
        this.status = 'error';
        this.onStatusChange?.('error');
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Encodes and transmits the 13-17 key pose landmarks to the TV over the pose channel.
   * Skips transmission if the buffer has queued data (> 4KB) to prevent network lag on spotty Wi-Fi.
   */
  public sendPosePacket(landmarks: Landmark3D[] | null) {
    if (!this.poseConn || !this.poseConn.open) return;

    // Check backpressure buffer to avoid piling up late frames
    const rtcChannel = (this.poseConn as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
    if (rtcChannel && rtcChannel.bufferedAmount > 4096) {
      return; // Skip this frame cleanly
    }

    if (!landmarks) {
      // Send absent notification
      const absentPacket: CompactPosePacket = {
        seq: ++this.seq,
        t: Date.now(),
        lm: {},
        absent: true,
      };
      try {
        this.poseConn.send(absentPacket);
      } catch {
        // Non-blocking
      }
      return;
    }

    const lmDict: CompactPosePacket['lm'] = {};
    for (const id of STREAMED_LANDMARK_IDS) {
      const point = landmarks[id];
      if (point) {
        lmDict[id] = [
          Math.round(point.x * 1000) / 1000,
          Math.round(point.y * 1000) / 1000,
          Math.round((point.visibility ?? 1) * 1000) / 1000,
        ];
      }
    }

    const packet: CompactPosePacket = {
      seq: ++this.seq,
      t: Date.now(),
      lm: lmDict,
    };

    try {
      this.poseConn.send(packet);
    } catch {
      // Non-blocking
    }
  }

  /**
   * Sends reliable command to TV.
   */
  public sendControlCommand(cmd: TvControlCommand) {
    if (this.controlConn && this.controlConn.open) {
      try {
        this.controlConn.send(cmd);
      } catch {
        // Non-blocking
      }
    }
  }

  public disconnect() {
    this.releaseWakeLock();

    try {
      this.poseConn?.close();
      this.controlConn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore
    }

    this.poseConn = null;
    this.controlConn = null;
    this.peer = null;
    const wasConnected = this.status === 'connected';
    this.status = 'disconnected';
    this.connectedCode = null;

    if (wasConnected) {
      this.onStatusChange?.('disconnected');
    }
  }
}

export const phoneCastSession = new PhoneSenderSession();
if (typeof window !== 'undefined') {
  (window as unknown as { phoneCastSession: PhoneSenderSession }).phoneCastSession = phoneCastSession;
}
