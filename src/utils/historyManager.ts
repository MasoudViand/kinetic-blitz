import { SessionRecord } from '../types/game';

const STORAGE_KEY = 'kinetic_blitz_workout_history';
const LEGACY_STORAGE_KEY = 'kinetic_pulse_workout_history';

export class HistoryManager {
  public static getHistory(): SessionRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as SessionRecord[];
    } catch {
      return [];
    }
  }

  public static saveSession(record: Omit<SessionRecord, 'id' | 'date'>): SessionRecord {
    const fullRecord: SessionRecord = {
      ...record,
      id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
    };

    const history = this.getHistory();
    history.unshift(fullRecord); // Most recent first

    // Keep last 100 sessions
    if (history.length > 100) {
      history.length = 100;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to save workout history to localStorage:', e);
    }

    return fullRecord;
  }

  public static getLifetimeStats() {
    const history = this.getHistory();
    let totalCalories = 0;
    let totalScore = 0;
    let bestScore = 0;
    let totalHits = 0;
    let totalDodges = 0;
    let totalDuration = 0;

    for (const s of history) {
      totalCalories += s.caloriesBurned || 0;
      totalScore += s.score || 0;
      if (s.score > bestScore) bestScore = s.score;
      totalHits += (s.pulseHits || 0) + (s.solarHolds || 0);
      totalDodges += s.lasersDodged || 0;
      totalDuration += s.durationSeconds || 0;
    }

    return {
      totalWorkouts: history.length,
      totalCalories: Math.round(totalCalories * 10) / 10,
      totalScore,
      bestScore,
      totalHits,
      totalDodges,
      totalDurationMinutes: Math.round(totalDuration / 60),
    };
  }

  public static clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear workout history:', e);
    }
  }
}
