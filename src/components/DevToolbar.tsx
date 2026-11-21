import React, { useState } from 'react';
import { mockPoseProvider } from '../vision/mockPoseProvider';
import { PostureType } from '../types/game';
import { Bot, ChevronDown, ChevronUp, User, Armchair, Zap, Shield, UserX, UserCheck } from 'lucide-react';

interface DevToolbarProps {
  onPostureChanged?: (posture: PostureType) => void;
}

export const DevToolbar: React.FC<DevToolbarProps> = ({ onPostureChanged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mockActive, setMockActive] = useState(mockPoseProvider.enabled);
  const [botActive, setBotActive] = useState(mockPoseProvider.isBotActive);
  const [simPosture, setSimPosture] = useState<PostureType>(mockPoseProvider.simulatedPosture);
  const [isPresent, setIsPresent] = useState(mockPoseProvider.isPresent);

  const toggleMock = () => {
    mockPoseProvider.enabled = !mockPoseProvider.enabled;
    setMockActive(mockPoseProvider.enabled);
  };

  const toggleBot = () => {
    mockPoseProvider.isBotActive = !mockPoseProvider.isBotActive;
    setBotActive(mockPoseProvider.isBotActive);
  };

  const setPosture = (p: PostureType) => {
    mockPoseProvider.simulatedPosture = p;
    setSimPosture(p);
    onPostureChanged?.(p);
  };

  const togglePresence = () => {
    mockPoseProvider.isPresent = !mockPoseProvider.isPresent;
    setIsPresent(mockPoseProvider.isPresent);
  };

  return (
    <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 z-50 flex flex-col items-start font-sans max-w-[calc(100vw-1rem)]">
      {/* Drawer Panel */}
      {isOpen && (
        <div className="mb-2 p-3 sm:p-3.5 rounded-xl bg-slate-900/95 border border-slate-700 backdrop-blur-md shadow-2xl text-xs w-64 sm:w-72 max-w-full max-h-[70vh] overflow-y-auto flex flex-col gap-2 sm:gap-2.5 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-arcade font-bold text-pulse-cyan text-[11px] tracking-wider uppercase">
              Dev & Mock Controls
            </span>
            <span className="text-[10px] text-gray-400">?mock=true</span>
          </div>

          {/* Mock Provider Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Mock Pose Feed:</span>
            <button
              onClick={toggleMock}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                mockActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-gray-400'
              }`}
            >
              {mockActive ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          {/* Autonomous Bot Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Auto-Player Bot:</span>
            <button
              onClick={toggleBot}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                botActive ? 'bg-pulse-cyan/20 text-pulse-cyan border border-pulse-cyan/40' : 'bg-slate-800 text-gray-400'
              }`}
            >
              {botActive ? 'ENABLED' : 'MANUAL'}
            </button>
          </div>

          {/* Posture Simulation */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Simulate Posture:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPosture('standing')}
                className={`p-1 rounded flex items-center gap-1 ${
                  simPosture === 'standing'
                    ? 'bg-pulse-cyan text-black font-bold'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-3 h-3" />
                Stand
              </button>
              <button
                onClick={() => setPosture('seated')}
                className={`p-1 rounded flex items-center gap-1 ${
                  simPosture === 'seated'
                    ? 'bg-pulse-gold text-black font-bold'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                <Armchair className="w-3 h-3" />
                Sit
              </button>
            </div>
          </div>

          {/* Presence Simulation (Auto-Pause testing) */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Presence:</span>
            <button
              onClick={togglePresence}
              className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold ${
                isPresent
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
            >
              {isPresent ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
              {isPresent ? 'In Frame' : 'Absent (Pause)'}
            </button>
          </div>

          {/* Manual Trigger Buttons */}
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
            <div className="text-[10px] text-gray-400 font-medium">Manual Action Triggers:</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => mockPoseProvider.triggerPunch('left', 0.28, 0.4)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3 text-pulse-cyan" />
                Punch L
              </button>
              <button
                onClick={() => mockPoseProvider.triggerPunch('right', 0.72, 0.4)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3 text-pulse-magenta" />
                Punch R
              </button>
              <button
                onClick={() => mockPoseProvider.triggerSquat(800)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded flex items-center justify-center gap-1"
              >
                <Shield className="w-3 h-3 text-emerald-400" />
                Squat
              </button>
              <button
                onClick={() => mockPoseProvider.triggerLean('left', 800)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded flex items-center justify-center gap-1"
              >
                <Shield className="w-3 h-3 text-amber-400" />
                Lean L
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 hover:border-pulse-cyan text-xs font-arcade text-gray-300 hover:text-white backdrop-blur-md shadow-lg transition-all"
      >
        <Bot className="w-3.5 h-3.5 text-pulse-cyan" />
        <span>Dev Tools</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
    </div>
  );
};
