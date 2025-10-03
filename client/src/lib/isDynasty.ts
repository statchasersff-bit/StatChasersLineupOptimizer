export function isDynastyLeague(lg: any): boolean {
  // Most reliable: Check if previous_league_id exists (indicates dynasty/keeper)
  if (lg?.previous_league_id) return true;

  // Check name and description
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  if (/\bdynasty\b/i.test(name) || /\bkeeper(s)?\b/i.test(name)) return true;

  return false;
}