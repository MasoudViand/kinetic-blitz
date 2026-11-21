import Peer, { MediaConnection, DataConnection } from 'peerjs';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface TvHudPayload {
  phase: 'menu' | 'calibrating' | 'countdown' | 'playing' | 'paused' | 'tutorial' | 'summary';
  score: number;
  combo: number;
  maxCombo: number;
  timeLeft: number;
  overdriveActive: boolean;
  postureMode: string;
  calibrationCountdown: number;
  calories: number;
  rank?: string;
  accuracy?: number;
  totalHits?: number;
  difficulty?: string;
  mode?: string;
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
 * TV Host Controller: Registers kb-tv-${CODE} and accepts incoming calls & data connections.
 */
export class TvReceiverSession {
  private peer: Peer | null = null;
  private currentCall: MediaConnection | null = null;
  private currentConn: DataConnection | null = null;
  public roomCode: string;

  public onStreamReceived?: (stream: MediaStream) => void;
  public onHudUpdateReceived?: (payload: TvHudPayload) => void;
  public onClientConnected?: () => void;
  public onClientDisconnected?: () => void;
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

    peer.on('call', (call) => {
      console.log('[TvReceiver] Incoming media call from phone');
      this.currentCall = call;

      // Critical: Answer with NO stream parameters so camera-less TV never triggers getUserMedia
      call.answer();

      call.on('stream', (remoteStream) => {
        console.log('[TvReceiver] Media stream received on TV');
        this.onStreamReceived?.(remoteStream);
        this.onClientConnected?.();
      });

      call.on('close', () => {
        console.log('[TvReceiver] Media call closed');
        this.onClientDisconnected?.();
      });

      call.on('error', (err) => {
        console.warn('[TvReceiver] Call error:', err);
        this.onClientDisconnected?.();
      });
    });

    peer.on('connection', (conn) => {
      console.log('[TvReceiver] Incoming DataConnection from phone');
      this.currentConn = conn;

      conn.on('open', () => {
        console.log('[TvReceiver] DataConnection open');
        this.onClientConnected?.();
      });

      conn.on('data', (data) => {
        if (data && typeof data === 'object') {
          this.onHudUpdateReceived?.(data as TvHudPayload);
        }
      });

      conn.on('close', () => {
        console.log('[TvReceiver] DataConnection closed');
        this.onClientDisconnected?.();
      });

      conn.on('error', (err) => {
        console.warn('[TvReceiver] Data connection error:', err);
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

  public destroy() {
    try {
      this.currentCall?.close();
      this.currentConn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore
    }
    this.currentCall = null;
    this.currentConn = null;
    this.peer = null;
  }
}

/**
 * Phone Sender Controller: Captures canvas + audio, calls the TV, and syncs HUD telemetry.
 */
export class PhoneSenderSession {
  private peer: Peer | null = null;
  private call: MediaConnection | null = null;
  private conn: DataConnection | null = null;
  private combinedStream: MediaStream | null = null;
  private wakeLock: WakeLockSentinelLike | null = null;
  public status: CastConnectionStatus = 'disconnected';
  public connectedCode: string | null = null;

  public onStatusChange?: (status: CastConnectionStatus, code?: string) => void;
  public onError?: (err: Error) => void;

  /**
   * Acquire a screen wake lock so the phone screen doesn't dim or turn off during the workout.
   */
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

  public async connectToTv(
    code: string,
    canvas: HTMLCanvasElement,
    audioStream: MediaStream | null
  ): Promise<boolean> {
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
            const timeoutErr = new Error('Connection to TV timed out. Please check the code.');
            this.onError?.(timeoutErr);
            reject(timeoutErr);
          }
        }, 15000);

        peer.on('open', () => {
          const targetPeerId = getPeerIdForCode(cleanCode);
          console.log('[PhoneSender] Connecting to TV host:', targetPeerId);

          // 1. Capture canvas stream at 60 FPS
          const canvasStream = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream
            ? (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(60)
            : null;

          if (!canvasStream) {
            clearTimeout(timeoutId);
            const err = new Error('Canvas streaming is not supported in this browser.');
            this.status = 'error';
            this.onStatusChange?.('error');
            reject(err);
            return;
          }

          // 2. Combine video tracks with audio stream tracks
          const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
          if (audioStream) {
            tracks.push(...audioStream.getAudioTracks());
          }
          const combined = new MediaStream(tracks);
          this.combinedStream = combined;

          // 3. Initiate Media Call
          const call = peer.call(targetPeerId, combined);
          this.call = call;

          // Configure outbound video encoding guardrails (cap at 1280x720, maintain framerate)
          this.configureSenderParameters(call, canvas);

          call.on('close', () => {
            console.log('[PhoneSender] Call closed');
            this.disconnect();
          });

          call.on('error', (err) => {
            console.warn('[PhoneSender] Call error:', err);
            clearTimeout(timeoutId);
            this.disconnect();
            reject(err);
          });

          // 4. Initiate Data Connection for HUD telemetry
          const conn = peer.connect(targetPeerId, { reliable: true });
          this.conn = conn;

          conn.on('open', () => {
            console.log('[PhoneSender] DataConnection opened to TV');
            clearTimeout(timeoutId);
            this.status = 'connected';
            this.connectedCode = cleanCode;
            this.acquireWakeLock();
            this.onStatusChange?.('connected', cleanCode);
            resolve(true);
          });

          conn.on('close', () => {
            console.log('[PhoneSender] DataConnection closed');
            this.disconnect();
          });

          conn.on('error', (err) => {
            console.warn('[PhoneSender] DataConnection error:', err);
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

  private configureSenderParameters(call: MediaConnection, canvas: HTMLCanvasElement) {
    const applyParams = () => {
      try {
        const pc = (call as unknown as { peerConnection?: RTCPeerConnection }).peerConnection;
        if (!pc) return;

        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === 'video') {
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              const maxDim = Math.max(canvas.width || 1280, canvas.height || 720);
              if (maxDim > 1280) {
                params.encodings[0].scaleResolutionDownBy = maxDim / 1280;
              }
              // Set degradationPreference to maintain-framerate for low latency workout rhythm
              (params as unknown as { degradationPreference?: string }).degradationPreference = 'maintain-framerate';
              params.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
              sender.setParameters(params).catch(() => {});
            } catch {
              // Ignore
            }
          }
        });
      } catch {
        // Ignore
      }
    };

    // Attempt immediately and after brief negotiation window
    setTimeout(applyParams, 100);
    setTimeout(applyParams, 800);
  }

  public sendHudUpdate(payload: TvHudPayload) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(payload);
      } catch {
        // Non-blocking
      }
    }
  }

  public disconnect() {
    this.releaseWakeLock();

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach((t) => t.stop());
      this.combinedStream = null;
    }

    try {
      this.call?.close();
      this.conn?.close();
      this.peer?.destroy();
    } catch {
      // Ignore
    }

    this.call = null;
    this.conn = null;
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
