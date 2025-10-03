export function isDynastyLeague(lg: any): boolean {
  // Check if previous_league_id exists (indicates dynasty/keeper continuation)
  if (lg?.previous_league_id) return true;

  // Check for keeper settings (actual keeper slots configured)
  const keepers = lg?.settings?.keeper_count ?? lg?.settings?.keepers ?? 0;
  if (keepers > 0) return true;

  // Check settings type field for explicit dynasty/keeper designation
  const settingsType = String(lg?.settings?.type ?? "").toLowerCase();
  if (settingsType === "dynasty" || settingsType === "keeper") return true;

  // Check name and description for dynasty/keeper keywords (case-insensitive)
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  if (name.includes("dynasty") || name.includes("keeper")) return true;

  return false;
}