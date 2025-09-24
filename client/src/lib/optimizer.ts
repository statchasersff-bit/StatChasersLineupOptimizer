import type { Projection, PlayerLite, RosterSlot } from "./types";
import { normalizePos } from "./projections";

const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ["RB","WR","TE"],
  WRT: ["RB","WR","TE"],
  WRTQ: ["RB","WR","TE","QB"],
  SUPER_FLEX: ["QB","RB","WR","TE"],
  REC_FLEX: ["WR","TE"],
  RB_WR: ["RB","WR"],
  RB_WR_TE: ["RB","WR","TE"],
};

function isFlex(slot: string) {
  return Boolean(FLEX_ELIGIBILITY[slot.toUpperCase()]);
}

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
  if (s.includes("OUT")) flags.push("OUT");
  if (s.includes("DOU")) flags.push("DOUB");
  if (s.includes("SUS")) flags.push("SUS");
  if (s.includes("QUE")) flags.push("Q"); // Questionable
  if ((p.opp || "").toUpperCase() === "BYE") flags.push("BYE");
  if (p.locked) flags.push("LOCKED");
  return flags;
}

function byProjDesc(a: any, b: any) { return (b.proj ?? 0) - (a.proj ?? 0); }

export function optimizeLineup(
  slotsMap: Record<string, number>,
  players: (PlayerLite & { proj?: number; opp?: string })[],
  season?: string,
  week?: string,
  currentStarters?: (string | null)[]
): RosterSlot[] {
  const slotList: string[] = [];
  Object.entries(slotsMap).forEach(([slot, n]) => { for (let i=0;i<n;i++) slotList.push(slot); });

  const filled: RosterSlot[] = slotList.map((s) => ({ slot: s }));
  const used = new Set<string>();

  // Step 1: If we have current starters, preserve any locked players in their current positions
  if (currentStarters && season && week) {
    for (let i = 0; i < Math.min(currentStarters.length, filled.length); i++) {
      const starterId = currentStarters[i];
      if (!starterId || starterId === "0" || starterId === "") continue;
      
      const player = players.find(p => p.player_id === starterId);
      if (player && (player as any).locked) {
        // Keep locked player in their current position
        filled[i].player = player;
        used.add(player.player_id);
      }
    }
  }

  // Step 2: For remaining slots, optimize using all available players
  // (Game locking should be handled at a higher level when building player pools)
  const sorted = [...players].sort(byProjDesc);

  // fill fixed positions first (skip already filled locked positions)
  for (let i=0;i<filled.length;i++){
    if (filled[i].player) continue; // Skip locked positions
    const slot = filled[i].slot;
    if (isFlex(slot)) continue;
    const idx = sorted.findIndex(p =>
      !used.has(p.player_id) &&
      (p.multiPos?.includes(normalizePos(slot)) || normalizePos(p.pos) === normalizePos(slot))
    );
    if (idx !== -1) { filled[i].player = sorted[idx]; used.add(sorted[idx].player_id); }
  }
  // then flex (skip already filled locked positions)
  for (let i=0;i<filled.length;i++){
    if (filled[i].player) continue; // Skip locked positions
    const slot = filled[i].slot;
    if (!isFlex(slot)) continue;
    const elig = FLEX_ELIGIBILITY[slot.toUpperCase()] || [];
    const idx = sorted.findIndex(p => {
      if (used.has(p.player_id)) return false;
      const ppos = normalizePos(p.pos);
      const multi = (p.multiPos || []).map(normalizePos);
      return elig.includes(ppos) || multi.some(m => elig.includes(m));
    });
    if (idx !== -1) { filled[i].player = sorted[idx]; used.add(sorted[idx].player_id); }
  }
  return filled;
}

export function sumProj(slots: RosterSlot[]) {
  return slots.reduce((acc, s) => acc + (s.player?.proj ?? 0), 0);
}
