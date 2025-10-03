export function isDynastyLeague(lg: any): boolean {
  const leagueName = lg?.name ?? "";
  
  // Check settings.type as numeric enum (Sleeper's primary dynasty indicator)
  // 0 = redraft, 1 = keeper, 2 = dynasty
  const leagueType = Number(lg?.settings?.type);
  if (leagueType === 2 || leagueType === 1) {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: settings.type = ${leagueType}`);
    return true;
  }
  
  // Check if previous_league_id exists (indicates dynasty/keeper continuation)
  if (lg?.previous_league_id) {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: has previous_league_id`);
    return true;
  }

  // Check for keeper settings (actual keeper slots configured)
  const keepers = lg?.settings?.keeper_count ?? lg?.settings?.keepers ?? 0;
  if (keepers > 0) {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: keeper_count = ${keepers}`);
    return true;
  }

  // Legacy check: some older leagues may use string type
  const settingsType = String(lg?.settings?.type ?? "").toLowerCase();
  if (settingsType === "dynasty" || settingsType === "keeper") {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: settings.type string = "${settingsType}"`);
    return true;
  }

  // Fallback: Check name and description for dynasty/keeper keywords (case-insensitive)
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  
  // Match full words: "dynasty" or "keeper"
  if (name.includes("dynasty") || name.includes("keeper")) {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: name/desc contains keyword`);
    return true;
  }
  
  // Match common dynasty abbreviations: "D" followed by number (e.g., "D10", "D12", "D13")
  // Use word boundary to avoid false positives
  if (/\bd\d+\b/i.test(name)) {
    console.log(`[Dynasty Filter] "${leagueName}" marked as dynasty: name matches D## pattern`);
    return true;
  }

  return false;
}