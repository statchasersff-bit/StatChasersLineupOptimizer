export function isDynastyLeague(lg: any): boolean {
  // Check if previous_league_id exists (indicates dynasty/keeper continuation)
  if (lg?.previous_league_id) return true;

  // Check metadata for dynasty/keeper indicators
  if (lg?.metadata?.copy_from_league_id) return true;
  if (lg?.metadata?.league_history) return true;
  if (lg?.metadata?.auto_continue === "on") return true;

  // Check for keeper settings
  const keepers = lg?.settings?.keeper_count ?? lg?.settings?.keepers ?? 0;
  if (keepers > 0) return true;

  // Check settings type field
  const settingsType = String(lg?.settings?.type ?? "").toLowerCase();
  if (settingsType === "dynasty" || settingsType === "keeper") return true;

  // Check name and description for dynasty/keeper keywords
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  if (/\bdynasty\b/i.test(name) || /\bkeeper(s)?\b/i.test(name)) return true;

  return false;
}