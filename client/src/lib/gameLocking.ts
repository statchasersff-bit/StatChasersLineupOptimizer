// Game locking logic to prevent lineup changes for teams that have already played

export type GameSchedule = Record<string, { start: number; state: 'pre' | 'in' | 'post' }>;

/**
 * Fetch week schedule from the backend API
 */
export async function getWeekSchedule(season: string, week: string): Promise<GameSchedule> {
  try {
    const response = await fetch(`/api/schedule?season=${season}&week=${week}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch schedule: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch week schedule:', error);
    return {};
  }
}

/**
 * Check if a team's game has started or finished
 */
export function hasGameStarted(team: string | undefined, schedule: GameSchedule, now: number = Date.now()): boolean {
  if (!team) return false;
  
  const teamData = schedule[team.toUpperCase()];
  if (!teamData) return false;
  
  // Game has started if it's not in 'pre' state or if current time is past kickoff
  return teamData.state !== 'pre' || now >= teamData.start;
}

/**
 * Check if a team is on bye (not in the schedule)
 * Returns false if schedule data is missing to avoid false positives
 */
export function isTeamOnBye(team: string | undefined, schedule: GameSchedule): boolean {
  if (!team) return true;
  
  // If schedule is empty or missing (e.g., ESPN API failed), fail open
  // This prevents all players from being marked as locked due to missing data
  if (!schedule || Object.keys(schedule).length === 0) {
    return false;
  }
  
  return !schedule[team.toUpperCase()];
}

/**
 * Check if a player should be excluded from waiver recommendations
 * (their team has already played or is on bye)
 */
export function isPlayerLocked(player: { team?: string }, schedule: GameSchedule, now: number = Date.now()): boolean {
  return hasGameStarted(player.team, schedule, now) || isTeamOnBye(player.team, schedule);
}

/**
 * Filter out locked players from a list
 */
export function filterUnlockedPlayers<T extends { team?: string }>(
  players: T[], 
  schedule: GameSchedule,
  now: number = Date.now()
): T[] {
  return players.filter(player => !isPlayerLocked(player, schedule, now));
}

/**
 * Get all locked teams for a given week
 */
export function getLockedTeams(schedule: GameSchedule, now: number = Date.now()): string[] {
  const lockedTeams: string[] = [];
  
  for (const [team, gameData] of Object.entries(schedule)) {
    if (hasGameStarted(team, schedule, now)) {
      lockedTeams.push(team);
    }
  }
  
  return lockedTeams;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use hasGameStarted with schedule instead
 */
export function hasTeamPlayed(team: string | undefined, season: string, week: string): boolean {
  // For backward compatibility, assume team has played if no schedule available
  console.warn('hasTeamPlayed is deprecated, use hasGameStarted with schedule instead');
  return false;
}