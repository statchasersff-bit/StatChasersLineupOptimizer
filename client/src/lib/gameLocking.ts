// Game locking logic to prevent lineup changes for teams that have already played

// Teams that have already played their games for the current week
// This would ideally be fetched from an API, but for now we'll hardcode known completed games
const completedGames: Record<string, Record<string, string[]>> = {
  "2025": {
    "2": ["WAS", "GB"], // Week 2: Commanders @ Packers (already played)
    // Add more weeks as games are completed
  }
};

/**
 * Check if a team has already played their game for the specified week
 */
export function hasTeamPlayed(team: string | undefined, season: string, week: string): boolean {
  if (!team) return false;
  
  const seasonGames = completedGames[season];
  if (!seasonGames) return false;
  
  const weekGames = seasonGames[week];
  if (!weekGames) return false;
  
  return weekGames.includes(team.toUpperCase());
}

/**
 * Check if a player is locked (their team has already played)
 */
export function isPlayerLocked(player: { team?: string }, season: string, week: string): boolean {
  return hasTeamPlayed(player.team, season, week);
}

/**
 * Filter out locked players from a list
 */
export function filterUnlockedPlayers<T extends { team?: string }>(
  players: T[], 
  season: string, 
  week: string
): T[] {
  return players.filter(player => !isPlayerLocked(player, season, week));
}

/**
 * Get all locked teams for a given week
 */
export function getLockedTeams(season: string, week: string): string[] {
  const seasonGames = completedGames[season];
  if (!seasonGames) return [];
  
  return seasonGames[week] || [];
}