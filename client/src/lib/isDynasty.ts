export function isDynastyLeague(lg: any): boolean {
  // Temporary debug logging for "The Blueprint" league
  if (lg?.name?.toLowerCase().includes("blueprint")) {
    console.log("[Dynasty Debug] The Blueprint league data:", {
      name: lg.name,
      previous_league_id: lg.previous_league_id,
      keeper_count: lg?.settings?.keeper_count,
      keepers: lg?.settings?.keepers,
      type: lg?.settings?.type,
      metadata: lg?.metadata,
      description: lg?.metadata?.description,
    });
  }

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

  return false;
}