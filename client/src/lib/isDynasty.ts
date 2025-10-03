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
  
  // Match full words: "dynasty" or "keeper"
  if (name.includes("dynasty") || name.includes("keeper")) return true;
  
  // Match common dynasty abbreviations: "D" followed by number (e.g., "D10", "D12", "D13")
  // Use word boundary to avoid false positives
  if (/\bd\d+\b/i.test(name)) return true;
  
  // Check for version numbers in league name (e.g., "2.0", "2.1", "V2") which often indicate multi-year leagues
  // Match patterns like: 2.0, 2.1, v2, V2, etc.
  const leagueName = lg?.name ?? "";
  if (/\d+\.\d+/.test(leagueName) || /\bv\d+\b/i.test(leagueName)) {
    // Additional check: if it also has auto_continue or copy_from_league_id, it's likely dynasty
    if (lg?.metadata?.auto_continue || lg?.metadata?.copy_from_league_id) {
      return true;
    }
  }

  return false;
}