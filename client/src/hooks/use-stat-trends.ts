import { useEffect, useState } from 'react';

interface StatHistory {
  key: string;
  current: number;
  previous?: number;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  updatedAt: string;
}

interface StatTrends {
  leagues: StatHistory;
  potential: StatHistory;
  outByeEmpty: StatHistory;
  ques: StatHistory;
  wins: StatHistory;
}

/**
 * Hook to track stat trends using localStorage
 * Stores previous analysis results and calculates deltas
 */
export function useStatTrends(
  username: string,
  season: string,
  week: string,
  stats: {
    leagues: number;
    potential: number;
    outByeEmpty: number;
    ques: number;
    wins: number;
  }
): StatTrends {
  const [trends, setTrends] = useState<StatTrends>({
    leagues: { key: 'leagues', current: stats.leagues, updatedAt: new Date().toISOString() },
    potential: { key: 'potential', current: stats.potential, updatedAt: new Date().toISOString() },
    outByeEmpty: { key: 'outByeEmpty', current: stats.outByeEmpty, updatedAt: new Date().toISOString() },
    ques: { key: 'ques', current: stats.ques, updatedAt: new Date().toISOString() },
    wins: { key: 'wins', current: stats.wins, updatedAt: new Date().toISOString() },
  });

  useEffect(() => {
    if (!username || !season || !week) return;

    const storageKey = `stat-trends-${username}-${season}-${week}`;

    try {
      // Load previous values from localStorage
      const stored = localStorage.getItem(storageKey);
      const previous = stored ? JSON.parse(stored) : null;

      // Calculate trends for each stat
      const calculateTrend = (current: number, prev?: number): StatHistory => {
        if (prev === undefined || prev === current) {
          return {
            key: '',
            current,
            previous: prev,
            trend: 'flat',
            updatedAt: new Date().toISOString(),
          };
        }

        const delta = current - prev;
        return {
          key: '',
          current,
          previous: prev,
          delta,
          trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
          updatedAt: new Date().toISOString(),
        };
      };

      const newTrends: StatTrends = {
        leagues: { ...calculateTrend(stats.leagues, previous?.leagues), key: 'leagues' },
        potential: { ...calculateTrend(stats.potential, previous?.potential), key: 'potential' },
        outByeEmpty: { ...calculateTrend(stats.outByeEmpty, previous?.outByeEmpty), key: 'outByeEmpty' },
        ques: { ...calculateTrend(stats.ques, previous?.ques), key: 'ques' },
        wins: { ...calculateTrend(stats.wins, previous?.wins), key: 'wins' },
      };

      setTrends(newTrends);

      // Store current values for next comparison
      localStorage.setItem(storageKey, JSON.stringify({
        leagues: stats.leagues,
        potential: stats.potential,
        outByeEmpty: stats.outByeEmpty,
        ques: stats.ques,
        wins: stats.wins,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[useStatTrends] Error accessing localStorage:', error);
    }
  }, [username, season, week, stats.leagues, stats.potential, stats.outByeEmpty, stats.ques, stats.wins]);

  return trends;
}
