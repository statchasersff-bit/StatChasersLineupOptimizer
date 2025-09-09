import type { Projection } from "./types";
import { normalizePos } from "./projections";

export function getOwnedPlayerIds(allRosters: any[]): Set<string> {
  const owned = new Set<string>();
  for (const r of allRosters) {
    for (const id of (r.players || [])) if (id) owned.add(id);
    for (const id of (r.reserve || [])) if (id) owned.add(id);
    for (const id of (r.taxi || [])) if (id) owned.add(id);
    for (const id of (r.starters || [])) if (id) owned.add(id);
  }
  return owned;
}

/**
 * From projections + players index, create a lightweight pool of FAs.
 * Only keep players that have a projection and are NOT owned in the league.
 * Optionally limit number per position for performance.
 */
export function buildFreeAgentPool(opts: {
  playersIndex: Record<string, any>;
  owned: Set<string>;
  projIdx: Record<string, Projection>;
}) {
  const { playersIndex, owned, projIdx } = opts;
  const perPosCap = 125; // hard-coded cap for all positions

  const byPos: Record<
    string,
    { player_id: string; name: string; team?: string; pos: string; proj: number; opp?: string }[]
  > = {};

  const push = (p: any, pr: Projection, pid: string, pos: string) => {
    (byPos[pos] ||= []).push({
      player_id: pid,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || String(pid),
      team: p.team,
      pos,
      proj: pr.proj,
      opp: (pr as any).opp,
    });
  };

  for (const key in projIdx) {
    if (!/^\d+$/.test(key)) continue; // only numeric sleeper_ids
    const pid = key;
    if (owned.has(pid)) continue;
    const p = playersIndex[pid];
    if (!p) continue;
    const pos = normalizePos(p.position || p.fantasy_positions?.[0] || "");
    if (!pos) continue;
    const pr = projIdx[pid];
    if (!pr) continue;
    push(p, pr, pid, pos);
  }

  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
    byPos[pos] = byPos[pos].slice(0, perPosCap);
  }
  return byPos;
}