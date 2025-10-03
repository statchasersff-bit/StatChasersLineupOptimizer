import type { Projection } from "./types";
import { scoreByLeague } from "./scoring";
import { isPlayerLocked, type GameSchedule } from "./gameLocking";

const EXCLUDE_FA_STATUSES = new Set(["O", "IR", "NA"]);
const MAX_FA_PER_POS = 10;

type Slot = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "SUPER_FLEX";

const isFlexEligible = (pos: string) => pos === "RB" || pos === "WR" || pos === "TE";
const isSuperFlexEligible = (pos: string) => pos === "QB" || isFlexEligible(pos);

const slotEligible = (pos: string, slot: Slot) => {
  if (slot === "FLEX") return isFlexEligible(pos);
  if (slot === "SUPER_FLEX") return isSuperFlexEligible(pos);
  return pos === slot;
};

export interface FACandidate {
  player_id: string;
  name: string;
  team?: string;
  pos: string;
  proj: number;
  eligible: Slot[];
  isFA: boolean;
  opp?: string;
  injury_status?: string;
}

export async function buildFACandidates(
  ownedPlayerIds: Set<string>,
  allPlayers: Record<string, any>,
  projMap: Record<string, Projection>,
  leagueScoring: any,
  schedule?: GameSchedule,
  playedPlayerIds?: Record<string, boolean>
): Promise<FACandidate[]> {
  // Iterate through all projections (only numeric sleeper_id keys) to find free agents
  // This is the same approach as buildFreeAgentPool
  const buckets: Record<string, FACandidate[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
  };

  // Iterate through projMap looking for numeric sleeper_id keys only
  for (const key in projMap) {
    if (!/^\d+$/.test(key)) continue; // only numeric sleeper_ids, skip "name|team|pos" keys
    
    const pid = key;
    
    // Skip if owned
    if (ownedPlayerIds.has(pid)) continue;
    
    const p = allPlayers[pid];
    if (!p) continue;
    
    const proj = projMap[pid];
    if (!proj) continue;
    
    const pos = p.position;
    if (!buckets[pos]) continue; // ignore IDP etc.
    
    // Exclude kickers from FA candidates
    if (pos === "K") continue;
    
    // Exclude players on BYE or with OUT status
    if (proj.opp === "BYE") continue;
    const status = (p.injury_status || "").toUpperCase();
    if (EXCLUDE_FA_STATUSES.has(status)) continue;

    // Exclude players whose game has already started/finished (locked players)
    if (schedule && isPlayerLocked({ team: p.team, player_id: pid }, schedule, Date.now(), playedPlayerIds)) {
      continue;
    }

    // Calculate league-adjusted projection
    const stats = (proj as any)?.stats || {};
    const adjProj = scoreByLeague(pos, stats, leagueScoring, proj.proj);
    if (!(adjProj > 0)) continue;

    const eligible: Slot[] = (["QB", "RB", "WR", "TE", "K", "DEF", "FLEX", "SUPER_FLEX"] as Slot[])
      .filter((s) => slotEligible(pos, s));

    buckets[pos].push({
      player_id: pid,
      name: p.full_name,
      team: p.team,
      pos,
      proj: adjProj,
      eligible,
      isFA: true,
      opp: proj.opp,
      injury_status: p.injury_status,
    });
  }

  // Cap per position by projection (sort DESC with stable tiebreaker)
  const shortlist: FACandidate[] = [];
  for (const pos of Object.keys(buckets)) {
    const sorted = buckets[pos].sort((a, b) => {
      // Primary: sort by projection DESC
      if (a.proj !== b.proj) return b.proj - a.proj;
      // Tiebreaker: stable sort by player_id
      return a.player_id.localeCompare(b.player_id);
    });
    shortlist.push(...sorted.slice(0, MAX_FA_PER_POS));
  }
  return shortlist;
}
