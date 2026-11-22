import React from 'react';
import {
  X,
  ShieldCheck,
  Code2,
  ExternalLink,
  WifiOff,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const repoUrl = 'https://github.com/MasoudViand/kinetic-blitz';

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-slate-900/95 border border-slate-700 hover:border-pulse-cyan/50 transition-colors rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col text-left my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Decorative Background Glows (contained in overflow-hidden to prevent scrollbars) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
          <div className="absolute -top-16 -right-16 w-44 h-44 bg-pulse-cyan/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-pulse-magenta/15 rounded-full blur-3xl" />
        </div>

        {/* Top Header */}
        <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-pulse-cyan/15 border border-pulse-cyan/30 text-pulse-cyan shadow-sm">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] sm:text-[10px] font-bold tracking-wider uppercase mb-0.5 sm:mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                100% Offline • Open Source
              </div>
              <h2 className="text-lg sm:text-2xl font-black font-arcade text-white tracking-wider">
                KINETIC BLITZ
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-gray-400 hover:text-white transition-all border border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Informational Cards */}
        <div className="my-3 sm:my-4 space-y-2.5 sm:space-y-3">
          {/* Offline & Private */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-black/40 border border-slate-800 flex items-start gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h4 className="text-[11px] sm:text-xs font-arcade font-bold text-gray-200 flex items-center gap-1.5">
                <span>100% Offline & On-Device</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </h4>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 leading-relaxed">
                All computer vision pose tracking and machine learning models run strictly inside your browser via WebAssembly and WebGL. <strong className="text-gray-300">Zero camera feeds, audio recordings, or biometric data are ever sent over the network</strong>. Works completely without an active internet connection.
              </p>
            </div>
          </div>

          {/* Open Source */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-black/40 border border-slate-800 flex items-start gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-pulse-cyan/10 border border-pulse-cyan/20 text-pulse-cyan shrink-0 mt-0.5">
              <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h4 className="text-[11px] sm:text-xs font-arcade font-bold text-gray-200">
                Free & Open Source
              </h4>
              <p className="text-[10px] sm:text-[11px] text-gray-400 mt-1 leading-relaxed">
                Kinetic Blitz is open source under the AGPL-3.0 License. Built with React 18, TypeScript, Vite, Tailwind CSS, Google MediaPipe Tasks-Vision, and Web Audio API. Inspect the code, customize mechanics, or contribute!
              </p>
            </div>
          </div>

          {/* GitHub Address Card */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border border-pulse-cyan/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-white shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <div className="min-w-0">
                <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-pulse-cyan">GitHub Repository</div>
                <div className="text-[11px] sm:text-xs text-gray-200 truncate font-mono">{repoUrl}</div>
              </div>
            </div>

            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/20 shrink-0 cursor-pointer"
            >
              <span>View Source</span>
              <ExternalLink className="w-3.5 h-3.5 text-pulse-cyan" />
            </a>
          </div>
        </div>

        {/* Action Button: Got It / Dismiss */}
        <div className="pt-2 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-pulse-cyan to-pulse-magenta hover:opacity-95 active:scale-[0.99] font-arcade font-bold text-xs sm:text-sm text-black shadow-glow-cyan transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-black" />
            GOT IT, LET'S PLAY
          </button>
        </div>
      </div>
    </div>
  );
};
