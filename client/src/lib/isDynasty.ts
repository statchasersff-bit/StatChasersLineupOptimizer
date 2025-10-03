export function isDynastyLeague(lg: any): boolean {
  // Most reliable: Check if previous_league_id exists (indicates dynasty/keeper)
  if (lg?.previous_league_id) return true;

  // Check type field
  const t = String(lg?.settings?.type ?? lg?.type ?? "").toLowerCase();
  if (t.includes("dynasty") || t === "dynasty" || t === "keeper") return true;

  // Check name and description
  const name = `${lg?.name ?? ""} ${lg?.metadata?.description ?? ""}`.toLowerCase();
  if (/\bdynasty\b/i.test(name) || /\bkeeper(s)?\b/i.test(name)) return true;

  // Debug: Log leagues that might be dynasty but not detected
  const leagueName = lg?.name || "Unknown";
  if ((leagueName === "Thunder" || leagueName === "Not Like Us") && !lg?.previous_league_id) {
    console.log(`[Dynasty Debug] League "${leagueName}":`, {
      name: lg?.name,
      previous_league_id: lg?.previous_league_id,
      type: lg?.type,
      settings_type: lg?.settings?.type,
      keeper_deadline: lg?.settings?.keeper_deadline,
      draft_id: lg?.draft_id,
      metadata: lg?.metadata,
      status: lg?.status,
      season: lg?.season
    });
  }

  return false;
}