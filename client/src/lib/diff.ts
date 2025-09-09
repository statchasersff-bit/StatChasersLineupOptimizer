import type { LeagueSummary } from "./types";

export type LineupDiff = {
  ins: { player_id: string; name: string; pos: string; proj: number }[];
  outs: { player_id: string; name: string; pos: string; proj: number }[];
  // Best-effort mapping of which player should move into which slot
  moves: { slot: string; in_pid: string; in_name: string; out_pid?: string; out_name?: string; gain: number }[];
  delta: number;
};

export function buildLineupDiff(lg: LeagueSummary): LineupDiff {
  const fixedSlots = lg.roster_positions;

  // current starters (by player_id -> info)
  const curIds = lg.starters.filter(Boolean);
  const curSet = new Set(curIds);

  // optimal starters (by player_id -> info)
  const optPlayers = lg.optimalSlots.map(s => s.player).filter(Boolean) as any[];
  const optIds = optPlayers.map(p => p.player_id);
  const optSet = new Set(optIds);

  // true ins = in optimal but not in current
  const ins = optPlayers
    .filter(p => !curSet.has(p.player_id))
    .map(p => ({ player_id: p.player_id, name: p.name, pos: p.pos, proj: p.proj ?? 0 }));

  // true outs = in current but not in optimal
  const outs = curIds
    .filter(pid => !optSet.has(pid))
    .map(pid => {
      // try to find name/pos/proj from optimalSlots (bench info not carried; set proj 0 if unknown)
      const hit = optPlayers.find(p => p.player_id === pid);
      return { player_id: pid, name: hit?.name ?? `player_id ${pid}`, pos: hit?.pos ?? "", proj: hit?.proj ?? 0 };
    });

  // slot-level suggestions without self-swaps:
  // For each slot in optimal, suggest "put <opt player> into <slot>" and, if the current
  // player occupying that slot is NOT the same pid and is NOT used somewhere else in optimal, mark as out.
  const moves: LineupDiff["moves"] = [];
  const usedIn = new Set<string>(); // avoid suggesting the same 'in' twice
  const usedOut = new Set<string>();

  lg.optimalSlots.forEach((s, i) => {
    const inP = s.player;
    const slot = s.slot;
    if (!inP) return;

    const curPidAtSlot = curIds[i]; // what the user currently has in the same slot index
    const same = curPidAtSlot === inP.player_id;

    if (!same && !usedIn.has(inP.player_id)) {
      // if the current player in that slot is part of optimal elsewhere, we shouldn't call it an OUT
      const currentIsOptimalSomewhere = curPidAtSlot && optSet.has(curPidAtSlot);
      moves.push({
        slot,
        in_pid: inP.player_id,
        in_name: inP.name,
        out_pid: currentIsOptimalSomewhere ? undefined : curPidAtSlot,
        out_name: currentIsOptimalSomewhere ? undefined : (curPidAtSlot ? `player_id ${curPidAtSlot}` : undefined),
        gain: (inP.proj ?? 0),
      });
      usedIn.add(inP.player_id);
      if (curPidAtSlot && !currentIsOptimalSomewhere) usedOut.add(curPidAtSlot);
    }
  });

  return { ins, outs, moves, delta: lg.delta };
}