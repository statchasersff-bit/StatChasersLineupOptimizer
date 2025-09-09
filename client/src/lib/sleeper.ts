export async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function getUserByName(username: string) {
  return fetchJSON<{ user_id: string }>(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`);
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

export async function getPlayersIndex() {
  // Big object of all NFL players; cache in app state.
  return fetchJSON<Record<string, any>>("https://api.sleeper.app/v1/players/nfl");
}
