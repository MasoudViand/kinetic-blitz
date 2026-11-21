import React, { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'react-qr-code';
import {
  TvReceiverSession,
  TvHudPayload,
  generateRoomCode,
} from './tvCastService';
import {
  Tv,
  Volume2,
  VolumeX,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Flame,
  Trophy,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

export const TvReceiverView: React.FC = () => {
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [hudData, setHudData] = useState<TvHudPayload | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<TvReceiverSession | null>(null);
  const soundButtonRef = useRef<HTMLButtonElement | null>(null);

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.replace(/\/tv\/?$/, '')}/?tv=${roomCode}`
    : '';

  const initReceiver = useCallback((codeToUse: string) => {
    if (sessionRef.current) {
      sessionRef.current.destroy();
    }

    const session = new TvReceiverSession(codeToUse);
    sessionRef.current = session;

    session.onStreamReceived = (stream) => {
      console.log('[TvView] Setting remote media stream');
      setMediaStream(stream);
      setIsConnected(true);
      setErrorMsg(null);
    };

    session.onHudUpdateReceived = (payload) => {
      setHudData(payload);
    };

    session.onClientConnected = () => {
      setIsConnected(true);
      setErrorMsg(null);
    };

    session.onClientDisconnected = () => {
      console.log('[TvView] Client disconnected, resetting to pairing screen');
      setIsConnected(false);
      setMediaStream(null);
      setHudData(null);
      setSoundEnabled(false);
    };

    session.onError = (err) => {
      console.warn('[TvView] Receiver error:', err);
      setErrorMsg(err.message || 'Receiver connection error.');
    };

    session.start((registeredCode) => {
      setRoomCode(registeredCode);
    });
  }, []);

  useEffect(() => {
    initReceiver(roomCode);

    return () => {
      sessionRef.current?.destroy();
    };
  }, []); // Initialize on mount; handleRegenerateCode handles manual resets

  // Bind mediaStream to <video> element
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch((err) => {
        console.warn('[TvView] Video autoplay failed:', err);
      });
      // Focus sound button for TV remote D-pad
      if (!soundEnabled) {
        soundButtonRef.current?.focus();
      }
    }
  }, [mediaStream, soundEnabled]);

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined || !isFinite(seconds) || seconds < 0) return '∞';
    const totalSecs = Math.max(0, Math.floor(seconds));
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleEnableSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => {
        setSoundEnabled(true);
      }).catch((e) => {
        console.warn('Failed to unmute video:', e);
      });
    } else {
      setSoundEnabled(true);
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleRegenerateCode = () => {
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    initReceiver(newCode);
  };

  // 1. STREAMING / ACTIVE PLAYING VIEW (When smartphone is connected and stream is active)
  if (isConnected && mediaStream) {
    const phase = hudData?.phase || 'menu';

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black select-none flex items-center justify-center">
        {/* Fullscreen Video Stream */}
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el && mediaStream && el.srcObject !== mediaStream) {
              el.srcObject = mediaStream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
          muted={!soundEnabled}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />

        {/* Remote TV Audio Unmute Prompt (D-pad focusable) */}
        {!soundEnabled && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <button
              ref={soundButtonRef}
              onClick={handleEnableSound}
              autoFocus
              tabIndex={0}
              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-pulse-cyan text-black font-arcade font-black text-base shadow-glow-cyan border-2 border-white hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-pulse-cyan cursor-pointer"
            >
              <Volume2 className="w-6 h-6 animate-pulse" />
              <span>PRESS [OK] ON REMOTE FOR SOUND</span>
            </button>
          </div>
        )}

        {/* Menu Phase Subtle Banner */}
        {phase === 'menu' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full bg-slate-900/90 border border-pulse-cyan/50 backdrop-blur-md shadow-2xl flex items-center gap-3 text-white">
            <Smartphone className="w-5 h-5 text-pulse-cyan animate-pulse" />
            <span className="font-arcade text-sm tracking-wide">
              CONNECTED TO PHONE — SELECT WORKOUT ON YOUR PHONE
            </span>
          </div>
        )}

        {/* Calibration Overlay */}
        {(phase === 'calibrating' || phase === 'countdown') && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 pointer-events-none">
            <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border-2 border-pulse-cyan shadow-glow-cyan text-center flex flex-col items-center">
              <Sparkles className="w-12 h-12 text-pulse-cyan animate-spin mb-4" />
              <h2 className="text-3xl font-black font-arcade text-white tracking-widest mb-2">
                CALIBRATING BODY
              </h2>
              <p className="text-gray-300 text-sm mb-6">
                Stand or sit in camera view facing your phone
              </p>
              <div className="w-20 h-20 rounded-full border-4 border-pulse-cyan/30 border-t-pulse-cyan animate-spin flex items-center justify-center mb-4">
                <span className="text-2xl font-black font-arcade text-pulse-cyan">
                  {hudData?.calibrationCountdown || '...'}
                </span>
              </div>
              <div className="text-xs uppercase font-arcade tracking-wider text-pulse-gold">
                Mode: {hudData?.postureMode || 'Detecting'}
              </div>
            </div>
          </div>
        )}

        {/* In-Game Crisp High-Contrast TV HUD Overlay */}
        {(phase === 'playing' || phase === 'paused' || phase === 'tutorial') && hudData && (
          <div className="absolute inset-0 z-30 pointer-events-none p-6 md:p-8 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex items-start justify-between w-full">
              {/* Score & Multiplier */}
              <div className="flex flex-col">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest">SCORE</span>
                <span className="text-4xl md:text-5xl font-black font-arcade text-white drop-shadow-lg tracking-wider">
                  {hudData.score.toLocaleString()}
                </span>
                {hudData.combo > 1 && (
                  <div className="inline-flex items-center gap-1.5 mt-1">
                    <span className={`px-2.5 py-0.5 rounded-md font-black font-arcade text-xs ${
                      hudData.overdriveActive
                        ? 'bg-gradient-to-r from-pulse-cyan to-pulse-magenta text-black shadow-glow-cyan animate-pulse'
                        : 'bg-pulse-cyan/20 border border-pulse-cyan/40 text-pulse-cyan'
                    }`}>
                      {hudData.combo}x COMBO
                    </span>
                  </div>
                )}
              </div>

              {/* Time Remaining */}
              <div className="flex flex-col items-center">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest">TIME</span>
                <span className="text-4xl md:text-5xl font-black font-arcade text-pulse-cyan drop-shadow-lg font-mono">
                  {formatTime(hudData.timeLeft)}
                </span>
              </div>

              {/* Calories & Difficulty */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> CALORIES
                </span>
                <span className="text-3xl md:text-4xl font-black font-arcade text-amber-400 drop-shadow-lg">
                  {hudData.calories} <span className="text-xs text-gray-400 font-normal">kcal</span>
                </span>
                {hudData.difficulty && (
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-arcade font-bold uppercase bg-white/10 text-gray-300 border border-white/20">
                    {hudData.difficulty}
                  </span>
                )}
              </div>
            </div>

            {/* Paused Banner */}
            {phase === 'paused' && (
              <div className="self-center p-6 rounded-2xl bg-black/80 border-2 border-pulse-gold shadow-glow-gold text-center animate-pulse">
                <h3 className="text-4xl font-black font-arcade text-pulse-gold tracking-widest">
                  WORKOUT PAUSED
                </h3>
                <p className="text-xs text-gray-300 mt-2">
                  Resume or adjust settings on your smartphone
                </p>
              </div>
            )}

            {/* Bottom Status Ticker */}
            <div className="flex items-center justify-between text-xs text-gray-400 font-arcade">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>TV CAST ACTIVE</span>
              </div>
              <div className="flex items-center gap-4">
                <span>POSTURE: {hudData.postureMode.toUpperCase()}</span>
                {soundEnabled ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Volume2 className="w-3.5 h-3.5" /> AUDIO ON
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400">
                    <VolumeX className="w-3.5 h-3.5" /> AUDIO MUTED
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Workout Summary Overlay on TV */}
        {phase === 'summary' && hudData && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-8">
            <div className="max-w-xl w-full p-8 rounded-3xl bg-slate-900/95 border-2 border-pulse-cyan shadow-glow-cyan text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pulse-gold/20 border border-pulse-gold/40 text-pulse-gold text-xs font-arcade font-bold uppercase mb-3">
                <Trophy className="w-4 h-4" /> WORKOUT COMPLETE
              </div>
              <h2 className="text-4xl font-black font-arcade text-white tracking-wider mb-6">
                SESSION RESULTS
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full mb-6">
                <div className="p-4 rounded-xl bg-black/50 border border-slate-800">
                  <div className="text-[10px] font-arcade text-gray-400 uppercase">SCORE</div>
                  <div className="text-2xl font-black font-arcade text-white mt-1">
                    {hudData.score.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-slate-800">
                  <div className="text-[10px] font-arcade text-gray-400 uppercase">RANK</div>
                  <div className="text-2xl font-black font-arcade text-pulse-gold mt-1">
                    {hudData.rank || 'A'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-slate-800">
                  <div className="text-[10px] font-arcade text-gray-400 uppercase">CALORIES</div>
                  <div className="text-2xl font-black font-arcade text-amber-400 mt-1">
                    {hudData.calories} kcal
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-slate-800">
                  <div className="text-[10px] font-arcade text-gray-400 uppercase">MAX COMBO</div>
                  <div className="text-2xl font-black font-arcade text-pulse-cyan mt-1">
                    {hudData.maxCombo}x
                  </div>
                </div>
              </div>

              <p className="text-gray-400 text-xs font-arcade">
                Touch your phone to play again or return to main menu
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. PAIRING / WAITING SCREEN (No phone connected yet)
  return (
    <div className="relative w-full h-full min-h-[100dvh] overflow-y-auto bg-[#070b12] text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 select-none">
      {/* Decorative Cyber Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-pulse-cyan/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-pulse-magenta/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top TV Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-pulse-cyan/15 border border-pulse-cyan/40 text-pulse-cyan shadow-sm">
            <Tv className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-pulse-cyan/10 border border-pulse-cyan/30 text-pulse-cyan text-[10px] font-bold font-arcade tracking-wider uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pulse-cyan animate-pulse" />
              TV RECEIVER MODE
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-arcade tracking-wider bg-gradient-to-r from-pulse-cyan via-white to-pulse-magenta bg-clip-text text-transparent">
              KINETIC BLITZ
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerateCode}
            title="Generate new room code"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-gray-300 hover:text-white text-xs font-arcade transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Code</span>
          </button>

          <button
            onClick={handleToggleFullscreen}
            title="Toggle TV Fullscreen"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-gray-300 hover:text-white text-xs font-arcade transition-all cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Large QR Code & Room Code */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-10 md:gap-16 my-auto max-w-5xl mx-auto w-full">
        {/* Left: High-Contrast QR Code Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-slate-700 hover:border-pulse-cyan/50 shadow-2xl flex flex-col items-center text-center transition-all">
          <div className="p-4 bg-white rounded-2xl shadow-inner mb-4">
            <QRCode
              value={qrUrl}
              size={210}
              level="H"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            />
          </div>
          <span className="text-xs font-arcade text-pulse-cyan tracking-wider uppercase flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Scan with Phone Camera
          </span>
          <span className="text-[11px] text-gray-400 mt-1 font-mono break-all max-w-xs">
            {qrUrl}
          </span>
        </div>

        {/* Right: Big Room Code & Simple 3-Step Instructions */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-lg">
          <span className="text-xs font-arcade text-gray-400 uppercase tracking-widest mb-1">
            TV ROOM CODE
          </span>
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-black/60 border-2 border-pulse-cyan shadow-glow-cyan mb-6">
            <span className="text-5xl md:text-6xl font-black font-arcade text-white tracking-[0.25em] font-mono">
              {roomCode}
            </span>
          </div>

          <div className="space-y-4 w-full">
            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Scan QR or Open Site</h3>
                <p className="text-xs text-gray-400">Scan QR code above with your phone camera to pair instantly.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Tap "Play on TV"</h3>
                <p className="text-xs text-gray-400">On your phone, tap "Play on TV" and enter code <strong className="text-pulse-cyan font-mono">{roomCode}</strong>.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 text-left">
              <div className="w-7 h-7 rounded-full bg-pulse-cyan/20 border border-pulse-cyan text-pulse-cyan font-arcade font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <div>
                <h3 className="font-arcade text-sm font-bold text-white">Prop Phone Under TV</h3>
                <p className="text-xs text-gray-400">Place phone in landscape orientation under your TV facing your play area!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Footer */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 pt-5 text-xs text-gray-400 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
          <span className="font-arcade tracking-wider">
            WAITING FOR PHONE CONNECTION...
          </span>
        </div>

        {errorMsg && (
          <div className="text-rose-400 text-xs font-arcade">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Peer-to-peer WebRTC stream over Wi-Fi. Zero server storage.</span>
        </div>
      </div>
    </div>
  );
};
