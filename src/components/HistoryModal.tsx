import React, { useState } from 'react';
import { HistoryManager } from '../utils/historyManager';
import { SessionRecord } from '../types/game';
import {
  X,
  Flame,
  Trophy,
  Activity,
  Calendar,
  Trash2,
  Award,
  Zap,
  Shield,
  Sun,
  User,
  Armchair,
} from 'lucide-react';

interface HistoryModalProps {
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
  const [history, setHistory] = useState<SessionRecord[]>(HistoryManager.getHistory());
  const stats = HistoryManager.getLifetimeStats();

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all workout history?')) {
      HistoryManager.clearHistory();
      setHistory([]);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'easy':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Easy</span>;
      case 'hard':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">Hard</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-pulse-cyan/15 text-pulse-cyan border border-pulse-cyan/30">Medium</span>;
    }
  };

  const getRankBadge = (rank: string) => {
    const colors: Record<string, string> = {
      S: 'text-pulse-gold border-pulse-gold bg-pulse-gold/15',
      A: 'text-pulse-cyan border-pulse-cyan bg-pulse-cyan/15',
      B: 'text-pulse-magenta border-pulse-magenta bg-pulse-magenta/15',
      C: 'text-gray-300 border-gray-600 bg-gray-800/40',
    };
    return (
      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-black font-arcade text-xs ${colors[rank] || colors.C}`}>
        {rank}
      </span>
    );
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] bg-slate-900/95 border border-slate-700 rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-pulse-cyan/10 border border-pulse-cyan/30 text-pulse-cyan">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl font-bold font-arcade text-white tracking-wider">
                WORKOUT HISTORY
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-400">Track previous session scores, combos & calorie burn</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Lifetime Summary Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 my-2.5 sm:my-4 shrink-0">
          <div className="p-2 sm:p-3 rounded-xl bg-black/50 border border-slate-800 flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-3 h-3 text-pulse-cyan shrink-0" /> Workouts
            </span>
            <span className="text-lg sm:text-2xl font-black font-arcade text-white mt-0.5 sm:mt-1">
              {stats.totalWorkouts}
            </span>
          </div>

          <div className="p-2 sm:p-3 rounded-xl bg-black/50 border border-slate-800 flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400 shrink-0" /> Total Burn
            </span>
            <span className="text-lg sm:text-2xl font-black font-arcade text-amber-400 mt-0.5 sm:mt-1">
              {stats.totalCalories} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">kcal</span>
            </span>
          </div>

          <div className="p-2 sm:p-3 rounded-xl bg-black/50 border border-slate-800 flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Trophy className="w-3 h-3 text-pulse-gold shrink-0" /> Best Score
            </span>
            <span className="text-lg sm:text-2xl font-black font-arcade text-pulse-gold mt-0.5 sm:mt-1">
              {stats.bestScore.toLocaleString()}
            </span>
          </div>

          <div className="p-2 sm:p-3 rounded-xl bg-black/50 border border-slate-800 flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-arcade text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Award className="w-3 h-3 text-pulse-magenta shrink-0" /> Total Hits
            </span>
            <span className="text-lg sm:text-2xl font-black font-arcade text-pulse-magenta mt-0.5 sm:mt-1">
              {stats.totalHits}
            </span>
          </div>
        </div>

        {/* Sessions Scrollable List */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 sm:gap-2.5">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center text-gray-400 my-auto">
              <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-slate-700 mb-2 sm:mb-3" />
              <p className="font-arcade text-xs sm:text-sm text-gray-300">No workout records found</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1 max-w-xs">
                Complete your first workout session to start tracking your performance and calories.
              </p>
            </div>
          ) : (
            history.map((session) => (
              <div
                key={session.id}
                className="p-2.5 sm:p-3.5 rounded-xl bg-black/40 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3"
              >
                {/* Left: Rank, Mode, Date */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {getRankBadge(session.rank)}
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-arcade font-bold text-xs sm:text-sm text-white capitalize">
                        {session.mode} Burn
                      </span>
                      {getDifficultyBadge(session.difficulty)}
                      <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-gray-400">
                        {session.posture === 'standing' ? <User className="w-3 h-3" /> : <Armchair className="w-3 h-3" />}
                        <span className="capitalize">{session.posture}</span>
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">
                      {formatDate(session.date)} • {Math.round(session.durationSeconds)}s duration
                    </div>
                  </div>
                </div>

                {/* Right: Score, Calories, Hits */}
                <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-base sm:text-lg font-black font-arcade text-white tracking-wider">
                      {session.score.toLocaleString()} <span className="text-[9px] sm:text-[10px] text-gray-400 font-normal">pts</span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-amber-400 flex items-center justify-end gap-1 font-semibold">
                      <Flame className="w-3 h-3" />
                      {session.caloriesBurned} kcal
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col text-[10px] text-gray-400 gap-0.5 border-l border-slate-800 pl-3">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-pulse-cyan" /> {session.pulseHits} strikes ({session.powerHits} power)
                    </span>
                    <span className="flex items-center gap-1">
                      <Sun className="w-3 h-3 text-pulse-gold" /> {session.solarHolds} holds • <Shield className="w-3 h-3 text-emerald-400" /> {session.lasersDodged} dodges
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center shrink-0 mt-2">
            <span className="text-xs text-gray-500">
              Showing {history.length} saved session{history.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
