export function isDynastyLeague(lg: any): boolean {
  // Check if previous_league_id exists (indicates dynasty/keeper continuation)
  if (lg?.previous_league_id) return true;

  // Check metadata for dynasty/keeper indicators
  if (lg?.metadata?.copy_from_league_id) return true; // League copied from another (often dynasty)
  if (lg?.metadata?.league_history) return true; // League has historical data
  if (lg?.metadata?.auto_continue) return true; // League set to auto-continue

  // Check for keeper settings (actual keeper slots configured)
  const keepers = lg?.settings?.keeper_count ?? lg?.settings?.keepers ?? 0;
  if (keepers > 0) return true;

  // Check settings type field for explicit dynasty/keeper designation
  const settingsType = String(lg?.settings?.type ?? "").toLowerCase();
  if (settingsType === "dynasty" || settingsType === "keeper") return true;

  // Check name and description for dynasty/keeper keywords (case-insensitive)
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  
  // Match full words: "dynasty" or "keeper"
  if (name.includes("dynasty") || name.includes("keeper")) return true;
  
  // Match common dynasty abbreviations: "D" followed by number (e.g., "D10", "D12", "D13")
  // Use word boundary to avoid false positives
  if (/\bd\d+\b/i.test(name)) return true;

  return false;
}