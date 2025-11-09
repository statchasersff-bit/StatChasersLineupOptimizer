import { isBestBallLeague } from './isBestBall';
import { isDynastyLeague } from './isDynasty';

export interface LeagueFilterOptions {
  excludeBestBall?: boolean;    // Default: true (always exclude Best Ball)
  excludeDynasty?: boolean;     // Default: false (user toggle for dynasty/keeper)
}

export interface LeagueFilterResult<T> {
  filtered: T[];
  counts: {
    total: number;
    bestBallExcluded: number;
    dynastyExcluded: number;
    remaining: number;
  };
}

/**
 * Centralized league filtering logic used across Home and Matchups views.
 * Ensures consistent filtering behavior throughout the application.
 * 
 * @param leagues - Array of league objects to filter
 * @param options - Filtering options
 * @returns Filtered leagues and exclusion counts
 */
export function filterLeagues<T extends { league?: any }>(
  leagues: T[],
  options: LeagueFilterOptions = {}
): LeagueFilterResult<T> {
  const {
    excludeBestBall = true,  // Default: always exclude Best Ball
    excludeDynasty = false,  // Default: include dynasty/keeper unless toggled
  } = options;

  const total = leagues.length;
  let filtered = [...leagues];
  let bestBallExcluded = 0;
  let dynastyExcluded = 0;

  // ALWAYS filter out Best Ball leagues (unless explicitly disabled)
  if (excludeBestBall) {
    const beforeBestBall = filtered.length;
    filtered = filtered.filter(item => {
      const league = item.league || item;
      return !isBestBallLeague(league);
    });
    bestBallExcluded = beforeBestBall - filtered.length;
  }

  // Optionally filter out Dynasty/Keeper leagues (based on user toggle)
  if (excludeDynasty) {
    const beforeDynasty = filtered.length;
    filtered = filtered.filter(item => {
      const league = item.league || item;
      return !isDynastyLeague(league);
    });
    dynastyExcluded = beforeDynasty - filtered.length;
  }

  return {
    filtered,
    counts: {
      total,
      bestBallExcluded,
      dynastyExcluded,
      remaining: filtered.length,
    },
  };
}

/**
 * Simple wrapper for filtering an array of raw league objects.
 * Useful when leagues don't have a nested .league property.
 */
export function filterRawLeagues(
  leagues: any[],
  options: LeagueFilterOptions = {}
): LeagueFilterResult<any> {
  return filterLeagues(
    leagues.map(lg => ({ league: lg })),
    options
  ).filtered.map(item => item.league) as any;
}
