import { scoreByLeague } from "./scoring";
import type { Projection } from "./types";

export type Slot = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "SUPER_FLEX" | "BN";

export interface WaiverSuggestion {
  slot: Slot;
  inP: { player_id: string; name: string; pos: string; proj: number };
  outP: { player_id: string; name: string; pos: string; proj: number };
  delta: number;
}

export interface StarterWithSlot {
  player_id: string;
  name: string;
  pos: string;
  slot: Slot;
  proj: number;
}

export interface FreeAgent {
  player_id: string;
  name: string;
  pos: string;
  team: string;
  injury_status?: string;
}

export interface ScoredFreeAgent extends FreeAgent {
  proj: number;
  isByeOrOut: boolean;
}

// Slot eligibility helpers
export const isFlexEligible = (pos: string): boolean =>
  pos === "RB" || pos === "WR" || pos === "TE";

export const isSuperFlexEligible = (pos: string): boolean =>
  pos === "QB" || isFlexEligible(pos);

export function slotEligible(pos: string, slot: Slot): boolean {
  if (slot === "FLEX") return isFlexEligible(pos);
  if (slot === "SUPER_FLEX") return isSuperFlexEligible(pos);
  return pos === slot; // strict for primary slots
}

// Build starter floors by slot (worst starter per slot)
// Only calculates floors for slots that exist in the league's roster
export function buildStarterFloors(
  starters: StarterWithSlot[],
  activeSlots: Set<Slot>
): Record<Slot, { player_id: string; proj: number } | null> {
  const floors: Record<Slot, { player_id: string; proj: number } | null> = {
    QB: null,
    RB: null,
    WR: null,
    TE: null,
    K: null,
    DEF: null,
    FLEX: null,
    SUPER_FLEX: null,
    BN: null,
  };

  // Find worst starter for each primary slot
  for (const s of starters) {
    if (s.slot === "BN") continue;
    const cur = floors[s.slot];
    if (!cur || (s.proj ?? 0) < (cur.proj ?? 0)) {
      floors[s.slot] = { player_id: s.player_id, proj: s.proj ?? 0 };
    }
  }

  // Only calculate FLEX floor if league has FLEX position
  if (activeSlots.has("FLEX")) {
    const flexCandidates = starters.filter((s) =>
      slotEligible(s.pos, "FLEX")
    );
    floors.FLEX = flexCandidates.length
      ? flexCandidates.reduce(
          (m, s) =>
            m && m.proj <= (s.proj ?? 0)
              ? m
              : { player_id: s.player_id, proj: s.proj ?? 0 },
          null as any
        )
      : null;
  }

  // Only calculate SUPER_FLEX floor if league has SUPER_FLEX position
  if (activeSlots.has("SUPER_FLEX")) {
    const sfCandidates = starters.filter((s) =>
      slotEligible(s.pos, "SUPER_FLEX")
    );
    floors.SUPER_FLEX = sfCandidates.length
      ? sfCandidates.reduce(
          (m, s) =>
            m && m.proj <= (s.proj ?? 0)
              ? m
              : { player_id: s.player_id, proj: s.proj ?? 0 },
          null as any
        )
      : null;
  }

  return floors;
}

// Blocklist for players that should never appear in waiver suggestions
const WAIVER_BLOCKLIST = new Set([
  "Donnie Ernsberger",
  "Mark McNamee",
]);

// Fetch free agents for a league (not on any roster)
export async function getFreeAgentsForLeague(
  leagueId: string,
  allPlayers: Record<string, any>,
  ownedPlayerIds: Set<string>
): Promise<FreeAgent[]> {
  try {
    // Fetch trending free agents to limit pool size
    const response = await fetch(
      `https://api.sleeper.app/v1/players/nfl/trending/add?limit=300`
    );
    const trending = await response.json();

    // Filter to only unowned players
    const faIds = trending
      .map((t: any) => String(t.player_id))
      .filter((pid: string) => !ownedPlayerIds.has(pid) && allPlayers[pid]);

    // Map to lightweight objects and filter blocklist
    return faIds
      .map((pid: string) => {
        const p = allPlayers[pid];
        const name = (p.full_name || p.first_name + " " + p.last_name).trim();
        
        // Skip blocklisted players
        if (WAIVER_BLOCKLIST.has(name)) return null;
        
        return {
          player_id: pid,
          name: name,
          pos: p.position || p.fantasy_positions?.[0] || "UNKNOWN",
          team: p.team || "",
          injury_status: p.injury_status,
        };
      })
      .filter((fa): fa is FreeAgent => fa !== null);
  } catch (err) {
    console.error(`[Waivers] Error fetching free agents for league ${leagueId}:`, err);
    return [];
  }
}

// Score free agents with league-adjusted projections
export function scoreFreeAgents(
  fas: FreeAgent[],
  leagueScoring: any,
  projMap: Map<string, Projection>
): ScoredFreeAgent[] {
  return fas.map((p) => {
    const row = projMap.get(p.player_id);
    const base = row ? scoreByLeague(row.pos, row.stats || {}, leagueScoring) : 0;
    const isByeOrOut =
      row?.opp === "BYE" || ["O", "IR", "NA"].includes(p.injury_status || "");
    return { ...p, proj: base, isByeOrOut };
  });
}

// Compare FAs to floors and pick top suggestions
// Only checks against slots that exist in the league's roster
export function pickWaiverUpgrades(
  scoredFAs: ScoredFreeAgent[],
  starters: StarterWithSlot[],
  activeSlots: Set<Slot>,
  minGain: number = 1.5,
  maxSuggestions: number = 5
): WaiverSuggestion[] {
  const floors = buildStarterFloors(starters, activeSlots);
  const suggestions: WaiverSuggestion[] = [];

  // Build lookup of current starters by player_id for names/pos
  const byId = new Map(starters.map((s) => [s.player_id, s]));

  for (const fa of scoredFAs) {
    if (!fa || !Number.isFinite(fa.proj)) continue;
    if (fa.isByeOrOut) continue; // Skip BYE/OUT players
    
    // Explicitly exclude kickers from waiver recommendations
    if (fa.pos === "K") continue;

    // Check against each slot the FA can fill (only active slots in this league)
    (["QB", "RB", "WR", "TE", "DEF", "FLEX", "SUPER_FLEX"] as Slot[]).forEach(
      (slot) => {
        // Skip if league doesn't have this slot
        if (!activeSlots.has(slot)) return;
        if (!slotEligible(fa.pos, slot)) return;
        const floor = floors[slot];
        if (!floor) return;
        const delta = fa.proj - floor.proj;
        if (delta >= minGain) {
          const outS = byId.get(floor.player_id);
          suggestions.push({
            slot,
            inP: {
              player_id: fa.player_id,
              name: fa.name,
              pos: fa.pos,
              proj: fa.proj,
            },
            outP: {
              player_id: floor.player_id,
              name: outS?.name ?? "(starter)",
              pos: outS?.pos ?? "",
              proj: floor.proj,
            },
            delta,
          });
        }
      }
    );
  }

  // Deduplicate by FA & slot, keep the highest delta
  const key = (s: WaiverSuggestion) => `${s.slot}:${s.inP.player_id}`;
  const best = new Map<string, WaiverSuggestion>();
  for (const s of suggestions) {
    const k = key(s);
    if (!best.has(k) || best.get(k)!.delta < s.delta) best.set(k, s);
  }

  // Return top N sorted by delta
  return Array.from(best.values())
    .sort((a, b) => b.delta - a.delta)
    .slice(0, maxSuggestions);
}
