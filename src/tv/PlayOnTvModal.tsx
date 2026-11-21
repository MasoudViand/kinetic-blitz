import React, { useState, useEffect } from 'react';
import {
  X,
  Tv,
  Cast,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Loader2,
  Unlink,
} from 'lucide-react';
import { sanitizeRoomCode } from './tvCastService';

interface PlayOnTvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (code: string) => Promise<boolean | void>;
  onDisconnect: () => void;
  isConnected: boolean;
  connectedCode: string | null;
  initialCode?: string;
}

export const PlayOnTvModal: React.FC<PlayOnTvModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  isConnected,
  connectedCode,
  initialCode = '',
}) => {
  const [code, setCode] = useState<string>(initialCode ? sanitizeRoomCode(initialCode) : '');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      setCode(sanitizeRoomCode(initialCode));
    }
  }, [initialCode]);

  if (!isOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeRoomCode(e.target.value);
    setCode(sanitized);
    setErrorMsg(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 4) {
      setErrorMsg('Please enter a 4-character room code.');
      return;
    }

    setIsConnecting(true);
    setErrorMsg(null);

    try {
      await onConnect(code);
      setIsConnecting(false);
      onClose();
    } catch (err) {
      setIsConnecting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect to TV.');
    }
  };

  const tvUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.replace(/\/tv\/?$/, '')}/tv`
    : '';

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full bg-slate-900/95 border border-slate-700 hover:border-pulse-cyan/50 transition-colors rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Decorative Background Glows */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-pulse-cyan/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-pulse-magenta/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pulse-cyan/15 border border-pulse-cyan/30 text-pulse-cyan shadow-sm">
              <Cast className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pulse-cyan/10 border border-pulse-cyan/30 text-pulse-cyan text-[10px] font-bold tracking-wider uppercase mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pulse-cyan animate-pulse" />
                Wireless Display
              </div>
              <h2 className="text-xl font-black font-arcade text-white tracking-wider">
                PLAY ON TV
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-gray-400 hover:text-white transition-all border border-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* When already connected */}
        {isConnected ? (
          <div className="my-5 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black font-arcade text-white">
              CONNECTED TO TV
            </h3>
            <p className="text-xs text-gray-300 mt-1 mb-3">
              Streaming game video & audio to room <span className="text-pulse-cyan font-mono font-bold">{connectedCode}</span>
            </p>

            {/* Landscape placement tip */}
            <div className="w-full p-3.5 rounded-xl bg-black/40 border border-pulse-cyan/30 flex items-start gap-3 text-left mb-5">
              <Smartphone className="w-5 h-5 text-pulse-cyan shrink-0 mt-0.5" />
              <div className="text-xs text-gray-300">
                <strong className="text-white block font-semibold mb-0.5">Placement Tip:</strong>
                Prop your phone horizontally below your TV facing your play area for optimal pose tracking.
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  onDisconnect();
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-arcade font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
                DISCONNECT TV
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-arcade font-bold text-xs transition-all cursor-pointer"
              >
                DONE
              </button>
            </div>
          </div>
        ) : (
          /* Pairing Form */
          <form onSubmit={handleConnect} className="my-4 space-y-4">
            {/* 2-Step Instructions */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-black/40 border border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pulse-cyan/20 border border-pulse-cyan/40 text-pulse-cyan font-arcade font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <span className="text-gray-300">
                  Open <code className="px-1.5 py-0.5 rounded bg-slate-800 text-pulse-cyan font-mono font-bold text-[11px]">{tvUrl}</code> on your Android TV or Smart TV browser.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-pulse-cyan/20 border border-pulse-cyan/40 text-pulse-cyan font-arcade font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <span className="text-gray-300">
                  Enter the 4-character code shown on your TV screen below.
                </span>
              </div>
            </div>

            {/* Room Code Input */}
            <div>
              <label htmlFor="tv-room-code" className="block text-xs font-arcade font-bold text-gray-300 uppercase tracking-wider mb-2">
                4-Character TV Room Code
              </label>
              <div className="relative">
                <input
                  id="tv-room-code"
                  type="text"
                  autoFocus
                  maxLength={4}
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="K9XP"
                  className="w-full py-3.5 px-4 text-center font-mono font-black text-3xl tracking-[0.3em] uppercase bg-black/60 border-2 border-slate-700 rounded-xl focus:border-pulse-cyan focus:ring-2 focus:ring-pulse-cyan/30 text-white placeholder-gray-600 transition-all outline-none"
                />
              </div>
            </div>

            {/* Placement Tip */}
            <div className="p-3 rounded-xl bg-pulse-cyan/5 border border-pulse-cyan/20 flex items-start gap-2.5 text-[11px] text-gray-300">
              <Smartphone className="w-4 h-4 text-pulse-cyan shrink-0 mt-0.5" />
              <span>
                <strong>Tip:</strong> Prop your phone horizontally (landscape) below your TV facing your play area so the camera has a clear view of your body.
              </span>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 font-arcade font-bold text-xs transition-all cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="submit"
                disabled={code.length !== 4 || isConnecting}
                className="w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed font-arcade font-bold text-sm text-black shadow-glow-cyan transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CONNECTING...</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-4 h-4" />
                    <span>CONNECT TO TV</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
