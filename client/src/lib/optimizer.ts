import type { Projection, PlayerLite, RosterSlot } from "./types";
import { normalizePos } from "./projections";
import { canFillSlot, isFlexSlot } from "./slotRules";

export function buildSlotCounts(roster_positions: string[]) {
  const counts: Record<string, number> = {};
  for (const slot of roster_positions) {
    const s = slot.toUpperCase();
    if (s === "BN" || s === "IR" || s === "TAXI") continue;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

export function toPlayerLite(playersIndex: Record<string, any>, player_id: string): PlayerLite | null {
  const p = playersIndex[player_id];
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || p.last_name || String(player_id);
  const pos = normalizePos(p.position || p.fantasy_positions?.[0] || "");
  return {
    player_id,
    name,
    team: p.team,
    pos,
    multiPos: (p.fantasy_positions || []).map((x: string) => normalizePos(x)),
    injury_status: p.injury_status,
  };
}

export function statusFlags(p?: PlayerLite & { proj?: number; opp?: string; locked?: boolean }) {
  const flags: string[] = [];
  if (!p) return flags;
  const s = (p.injury_status || "").toUpperCase();
  // Match Sleeper's OUT status codes: O, IR, NA, SUS, SSPD, or string containing OUT
  if (s === "O" || s === "IR" || s === "NA" || s === "SUS" || s === "SSPD" || s.includes("OUT")) flags.push("OUT");
  if (s.includes("DOU")) flags.push("DOUB");
  if (s.includes("QUE") || s === "Q" || s === "D") flags.push("Q"); // Questionable/Doubtful
  if ((p.opp || "").toUpperCase() === "BYE") flags.push("BYE");
  if (p.locked) flags.push("LOCKED");
  return flags;
}

function byProjDesc(a: any, b: any) { return (b.proj ?? 0) - (a.proj ?? 0); }

export interface OptimizationResult {
  lineup: RosterSlot[];
  total: number;
  reachableTotal?: number; // Total respecting locks
  fullTotal?: number; // Total ignoring locks (for comparison)
  hasLockedPlayers?: boolean;
}

export function optimizeLineup(
  slotsMap: Record<string, number>,
  players: (PlayerLite & { proj?: number; opp?: string; locked?: boolean })[],
  season?: string,
  week?: string,
  currentStarters?: (string | null)[],
  respectLocks: boolean = true
): RosterSlot[] {
  const slotList: string[] = [];
  Object.entries(slotsMap).forEach(([slot, n]) => { for (let i=0;i<n;i++) slotList.push(slot); });

  const filled: RosterSlot[] = slotList.map((s) => ({ slot: s }));
  const used = new Set<string>();

  // Step 1: If respecting locks, freeze locked starters in their EXACT current slots
  if (respectLocks && currentStarters && season && week) {
    for (let i = 0; i < Math.min(currentStarters.length, filled.length); i++) {
      const starterId = currentStarters[i];
      if (!starterId || starterId === "0" || starterId === "") continue;
      
      const player = players.find(p => p.player_id === starterId);
      if (player && player.locked) {
        // Keep locked player in their current position
        filled[i].player = player;
        used.add(player.player_id);
      }
    }
  }

  // Step 2: Build pool of movable players (exclude locked starters if respecting locks)
  const availablePlayers = respectLocks 
    ? players.filter(p => !p.locked || used.has(p.player_id))
    : players;
  const sorted = [...availablePlayers].sort(byProjDesc);

  // fill fixed positions first (skip already filled locked positions)
  for (let i=0;i<filled.length;i++){
    if (filled[i].player) continue; // Skip locked positions
    const slot = filled[i].slot;
    if (isFlexSlot(slot)) continue;
    const idx = sorted.findIndex(p =>
      !used.has(p.player_id) && canFillSlot(p.pos, slot)
    );
    if (idx !== -1) { filled[i].player = sorted[idx]; used.add(sorted[idx].player_id); }
  }
  // then flex (skip already filled locked positions)
  for (let i=0;i<filled.length;i++){
    if (filled[i].player) continue; // Skip locked positions
    const slot = filled[i].slot;
    if (!isFlexSlot(slot)) continue;
    const idx = sorted.findIndex(p => {
      if (used.has(p.player_id)) return false;
      return canFillSlot(p.pos, slot);
    });
    if (idx !== -1) { filled[i].player = sorted[idx]; used.add(sorted[idx].player_id); }
  }
  return filled;
}

/**
 * Optimize lineup and calculate both reachable (respects locks) and full optimal (ignores locks)
 */
export function optimizeLineupWithLockComparison(
  slotsMap: Record<string, number>,
  players: (PlayerLite & { proj?: number; opp?: string; locked?: boolean })[],
  season?: string,
  week?: string,
  currentStarters?: (string | null)[]
): OptimizationResult {
  const hasLockedPlayers = players.some(p => p.locked);
  
  // Calculate reachable optimal (respects locks)
  const reachableLineup = optimizeLineup(slotsMap, players, season, week, currentStarters, true);
  const reachableTotal = sumProj(reachableLineup);
  
  let fullTotal = reachableTotal;
  
  // If there are locked players, also calculate full optimal (ignores locks) for comparison
  if (hasLockedPlayers) {
    const fullLineup = optimizeLineup(slotsMap, players, season, week, currentStarters, false);
    fullTotal = sumProj(fullLineup);
  }
  
  return {
    lineup: reachableLineup,
    total: reachableTotal,
    reachableTotal,
    fullTotal,
    hasLockedPlayers
  };
}

export function sumProj(slots: RosterSlot[]) {
  return slots.reduce((acc, s) => acc + (s.player?.proj ?? 0), 0);
}

/**
 * Filter out recommendations that would move or bench locked players
 * Locked players cannot be moved or benched since their games have started
 */
export function filterLockedRecommendations<T extends { in: {player_id: string}; out: {player_id: string} }>(
  recommendations: T[],
  lockedPlayerIds: Set<string>
): {
  allowed: T[];
  blocked: Array<T & { blockReason: string }>;
} {
  const allowed: T[] = [];
  const blocked: Array<T & { blockReason: string }> = [];
  
  for (const rec of recommendations) {
    const outIsLocked = lockedPlayerIds.has(rec.out.player_id);
    const inIsLocked = lockedPlayerIds.has(rec.in.player_id);
    
    if (outIsLocked) {
      blocked.push({
        ...rec,
        blockReason: `${rec.out.player_id} has already played. Cannot be moved or benched.`
      });
    } else if (inIsLocked) {
      // This shouldn't happen often (locked bench player) but handle it
      blocked.push({
        ...rec,
        blockReason: `${rec.in.player_id} has already played. Cannot be started.`
      });
    } else {
      allowed.push(rec);
    }
  }
  
  return { allowed, blocked };
}

/**
 * Compute lock-aware achievable delta
 * Returns the actual points that can be gained after filtering out locked recommendations
 * 
 * @param reachableOptimalTotal - Lock-respecting optimal total (from optimizeLineupWithLockComparison)
 * @param currentTotal - Current lineup total
 * @param recommendations - List of bench → starter recommendations
 * @param lockedPlayerIds - Set of player IDs that are locked
 * @returns Object with achievableDelta, blockedDelta, and filtered recommendations
 */
export function computeAchievableDelta<T extends { delta: number; in: {player_id: string}; out: {player_id: string} }>(
  reachableOptimalTotal: number,
  currentTotal: number,
  recommendations: T[],
  lockedPlayerIds: Set<string>
): {
  achievableDelta: number;
  blockedDelta: number;
  allowedRecommendations: T[];
  blockedRecommendations: Array<T & { blockReason: string }>;
} {
  // Filter recommendations to remove those blocked by locks
  const { allowed, blocked } = filterLockedRecommendations(recommendations, lockedPlayerIds);
  
  // Calculate blocked delta (sum of deltas from blocked recommendations)
  const blockedDelta = blocked.reduce((sum, rec) => sum + rec.delta, 0);
  
  // Calculate achievable delta using lock-respecting baseline
  // This matches Matchups' calculation: achievableDelta = max(0, optPoints - actPoints - blockedDelta)
  const benchDelta = reachableOptimalTotal - currentTotal;
  const achievableDelta = Math.max(0, benchDelta - blockedDelta);
  
  return {
    achievableDelta,
    blockedDelta,
    allowedRecommendations: allowed,
    blockedRecommendations: blocked
  };
}

/**
 * Build bench → starter recommendations by comparing current vs optimal lineups
 * Shared logic for both Home and Matchups views
 * 
 * @param currentSlots - Current starting lineup (with players)
 * @param optimalSlots - Optimal starting lineup (lock-respecting)
 * @param validStarters - Array of current starter player IDs
 * @param allEligible - All eligible players (for lock detection)
 * @param irList - List of IR player IDs (optional)
 * @returns Recommendations with lock filtering and delta calculations
 */
export function buildBenchRecommendations(
  currentSlots: RosterSlot[],
  optimalSlots: RosterSlot[],
  validStarters: string[],
  allEligible: (PlayerLite & { proj?: number; locked?: boolean })[],
  irList: string[] = []
): {
  recommendations: Array<{ out: any; in: any; slot: string; delta: number; fromIR?: boolean }>;
  filteredRecommendations: Array<{ out: any; in: any; slot: string; delta: number; fromIR?: boolean }>;
  blockedRecommendations: Array<{ out: any; in: any; slot: string; delta: number; fromIR?: boolean; blockReason: string }>;
  blockedDelta: number;
  lockedPlayerIds: Set<string>;
} {
  const recommendations: Array<{ out: any; in: any; slot: string; delta: number; fromIR?: boolean }> = [];
  
  // Create set of IR player IDs for tracking moves from IR
  const irPlayerIds = new Set(irList);
  
  // Identify which players are in current starters vs optimal starters
  const currStarterIds = new Set(validStarters);
  const optStarterIds = new Set(
    optimalSlots.map(s => s.player?.player_id).filter(Boolean)
  );
  
  // Find promotions (bench players entering starting lineup)
  const promotions = optimalSlots
    .filter(s => s.player && !currStarterIds.has(s.player.player_id))
    .map(s => ({ ...s.player, slot: s.slot }));
  
  // Find demotions (starters being benched)
  const demotions = currentSlots
    .filter(s => s.player && !optStarterIds.has(s.player.player_id))
    .map(s => ({ ...s.player, slot: s.slot }));
  
  // Pair promotions with demotions using greedy algorithm (highest gain first)
  const demotedPool = [...demotions];
  for (const inPlayer of promotions) {
    // Find best demotion to pair with (highest gain)
    let bestIdx = -1;
    let bestGain = -Infinity;
    let bestOut: any = null;
    
    for (let i = 0; i < demotedPool.length; i++) {
      const outPlayer = demotedPool[i];
      // Make sure it's not the same player and calculate gain
      if (inPlayer.player_id !== outPlayer.player_id) {
        const gain = (inPlayer.proj ?? 0) - (outPlayer.proj ?? 0);
        if (gain > bestGain) {
          bestGain = gain;
          bestIdx = i;
          bestOut = outPlayer;
        }
      }
    }
    
    if (bestOut && bestIdx >= 0) {
      recommendations.push({
        out: bestOut,
        in: inPlayer,
        slot: inPlayer.slot,
        delta: bestGain,
        fromIR: inPlayer.player_id ? irPlayerIds.has(inPlayer.player_id) : false
      });
      demotedPool.splice(bestIdx, 1);
    }
  }

  // Filter out recommendations that touch locked players
  const lockedPlayerIds = new Set<string>();
  allEligible.forEach(p => {
    if (p.locked) lockedPlayerIds.add(p.player_id);
  });
  
  const { allowed: filteredRecommendations, blocked: blockedRecommendations } = filterLockedRecommendations(
    recommendations,
    lockedPlayerIds
  );
  
  // Calculate blocked delta (sum of deltas from blocked recommendations)
  const blockedDelta = blockedRecommendations.reduce((sum, rec) => sum + rec.delta, 0);
  
  return {
    recommendations,
    filteredRecommendations,
    blockedRecommendations,
    blockedDelta,
    lockedPlayerIds
  };
}

/**
 * Lock-aware wrapper for building reachable lineup (respects locks)
 * Reusable for both bench-only and waiver-augmented pools
 */
export function buildReachableLineup(
  slotsMap: Record<string, number>,
  players: (PlayerLite & { proj?: number; opp?: string; locked?: boolean })[],
  season: string,
  week: string,
  currentStarters: (string | null)[]
): RosterSlot[] {
  // Always respect locks when building reachable lineup
  return optimizeLineup(slotsMap, players, season, week, currentStarters, true);
}

/**
 * State decision tree evaluator per user spec
 * Returns the league row state based on optimization metrics
 */
export type RowState = 'EMPTY' | 'BENCH' | 'WAIVER' | 'OPTIMAL' | 'UNKNOWN';

export interface StateEvalInputs {
  benchOptimalLineup: RosterSlot[];
  deltaBench: number;
  deltaWaiver: number;
  pickupsLeft: number;
  freeAgentsEnabled: boolean;
  threshold?: number;
}

export function deriveRowState(inputs: StateEvalInputs): RowState {
  const THRESH = inputs.threshold ?? 1.5;
  
  // Guard against NaN/undefined values
  if (!Number.isFinite(inputs.deltaBench) || !Number.isFinite(inputs.deltaWaiver)) {
    return 'UNKNOWN';
  }
  
  // Check for empty starters (any slot without a player)
  const hasEmpty = inputs.benchOptimalLineup.some(s => !s.player);
  
  // Decision tree per spec
  if (hasEmpty) {
    return 'EMPTY';
  } else if (inputs.deltaBench >= THRESH) {
    return 'BENCH';
  } else if (inputs.pickupsLeft > 0 && inputs.freeAgentsEnabled && inputs.deltaWaiver >= THRESH) {
    return 'WAIVER';
  } else {
    return 'OPTIMAL';
  }
}
