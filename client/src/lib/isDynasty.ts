// Detect dynasty leagues based on Sleeper league settings
export function isDynastyLeague(league: any): boolean {
  if (!league?.settings) return false;
  
  const settings = league.settings;
  
  // Dynasty leagues typically have:
  // 1. Higher roster sizes due to taxi/reserve spots
  // 2. Multiple draft rounds (rookie drafts)
  // 3. Keeper settings enabled
  // 4. League type may indicate dynasty
  
  // Check for explicit dynasty indicators
  if (league.name?.toLowerCase().includes('dynasty')) return true;
  if (league.name?.toLowerCase().includes('keeper')) return true;
  
  // Check settings that indicate dynasty
  const hasHighRosterCount = (settings.roster_positions?.length || 0) > 18;
  const hasReserveSlots = (settings.reserve_slots || 0) > 0;
  const hasTaxiSlots = (settings.taxi_slots || 0) > 0;
  const hasMultipleDrafts = settings.draft_rounds > 15; // typical rookie draft setup
  
  // Dynasty leagues usually have at least 2-3 of these characteristics
  const dynastyIndicators = [
    hasHighRosterCount,
    hasReserveSlots, 
    hasTaxiSlots,
    hasMultipleDrafts
  ].filter(Boolean).length;
  
  return dynastyIndicators >= 2;
}