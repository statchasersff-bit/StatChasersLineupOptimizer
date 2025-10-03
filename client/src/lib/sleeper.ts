export async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function getUserByName(username: string) {
  try {
    return await fetchJSON<{ user_id: string }>(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`);
  } catch (error: any) {
    // Sleeper API returns 404 for non-existent users, return null instead of throwing
    if (error.message?.includes('404')) {
      return null;
    }
    throw error; // Re-throw other errors
  }
}

export async function getUserLeagues(userId: string, season: string) {
  return fetchJSON<any[]>(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${season}`);
}

export async function getLeagueRosters(leagueId: string) {
  return fetchJSON<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId: string) {
  return fetchJSON<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/users`);
}

export async function getLeagueDetails(leagueId: string) {
  return fetchJSON<any>(`https://api.sleeper.app/v1/league/${leagueId}`);
}

export async function getLeagueMatchups(leagueId: string, week: string) {
  return fetchJSON<any[]>(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
}

export async function getPlayersIndex() {
  // Big object of all NFL players; cache in app state.
  return fetchJSON<Record<string, any>>("https://api.sleeper.app/v1/players/nfl");
}

/**
 * Get matchup data for all leagues to detect if players have already played/scored
 * This is more reliable than game start times for detecting locked players
 */
export async function getLeagueMatchupsForLocking(leagueIds: string[], week: string): Promise<Record<string, boolean>> {
  const playedPlayerIds: Record<string, boolean> = {};
  
  try {
    // Fetch matchup data for all leagues in parallel
    const matchupPromises = leagueIds.map(async (leagueId) => {
      try {
        const matchups = await getLeagueMatchups(leagueId, week);
        return { leagueId, matchups };
      } catch (error) {
        console.warn(`Failed to fetch matchups for league ${leagueId}:`, error);
        return { leagueId, matchups: [] };
      }
    });
    
    const results = await Promise.all(matchupPromises);
    
    // Process matchup data to identify players who have already played
    for (const { matchups } of results) {
      for (const matchup of matchups) {
        // Check if this matchup has individual player scoring data
        if (matchup.players_points && typeof matchup.players_points === 'object') {
          // Only mark players as played if they have POSITIVE points (indicating game has started)
          // Players with 0 points might just be pre-game initialization
          for (const [playerId, points] of Object.entries(matchup.players_points)) {
            if (playerId && playerId !== "0" && typeof points === 'number' && points > 0) {
              playedPlayerIds[playerId] = true;
            }
          }
        }
        // Note: Removed fallback logic that incorrectly marked ALL starters as played
        // if ANY player had points. This caused false positives for players who haven't played yet.
      }
    }
    
    console.log(`[Sleeper] Found ${Object.keys(playedPlayerIds).length} players who have already played`);
    return playedPlayerIds;
  } catch (error) {
    console.error('Failed to fetch league matchups for locking:', error);
    return {};
  }
}
