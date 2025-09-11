import type { LeagueSummary, RosterHealth } from "./types";
import { normalizePos } from "./projections";

type FAIndex = Record<string, { name: string; proj: number }[]>; // pos -> sorted FA list

const DECAY = [0.5, 0.3, 0.2]; // bench depth weights (top3 bench at a pos)

function group<T>(arr: T[], key: (x: T) => string) {
  return arr.reduce<Record<string, T[]>>((m, x) => {
    const k = key(x); (m[k] ||= []).push(x); return m;
  }, {});
}

export function computeRosterHealth(opts: {
  lg: LeagueSummary;
  faByPos: FAIndex | null; // null if you didn't build FA pool
}): RosterHealth {

  const { lg, faByPos } = opts;

  // 1) How many of each position are actually started? (quality-aware demand)
  const startedPlayers = lg.optimalSlots
    .map(s => s.player)
    .filter(Boolean) as { player_id: string; name: string; pos: string; proj?: number }[];

  const demandByPos: Record<string, number> = {};
  startedPlayers.forEach(p => {
    const pos = normalizePos(p.pos);
    demandByPos[pos] = (demandByPos[pos] ?? 0) + 1;
  });

  // 2) Starter quality per position
  const startersByPos = group(startedPlayers, p => normalizePos(p.pos));
  const startersProjByPos: Record<string, number> = {};
  Object.keys(startersByPos).forEach(pos => {
    startersProjByPos[pos] = startersByPos[pos].reduce((a, b) => a + (b.proj ?? 0), 0);
  });

  // 3) Bench quality with diminishing returns
  // Bench = your rostered players – starters (IDs)
  const startedIds = new Set(startedPlayers.map(p => p.player_id));
  const benchPlayers = (lg.benchDetail || []) as { player_id: string; name: string; pos: string; proj: number }[];
  const benchByPos = group(benchPlayers.filter(b => !startedIds.has(b.player_id)), b => normalizePos(b.pos));
  const depthWeightedByPos: Record<string, number> = {};
  Object.keys(benchByPos).forEach(pos => {
    const arr = benchByPos[pos].slice().sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0));
    const weighted = arr.slice(0, DECAY.length).reduce((sum, p, i) => sum + (p.proj ?? 0) * DECAY[i], 0);
    depthWeightedByPos[pos] = weighted;
  });

  // 4) Replacement baseline from FA pool (average of top K per pos)
  const K = 5;
  const replacementPerPos: Record<string, number> = {};
  Object.keys(demandByPos).forEach(pos => {
    const pool = faByPos?.[pos] ?? [];
    const avg = pool.slice(0, K).reduce((a, b) => a + (b.proj ?? 0), 0) / Math.max(1, Math.min(K, pool.length || 1));
    replacementPerPos[pos] = avg || 0;
  });

  // 5) Build strength objects
  const allPositions = Array.from(new Set(Object.keys(demandByPos)
    .concat(Object.keys(startersProjByPos))
    .concat(Object.keys(depthWeightedByPos))));

  const byPos = allPositions.map(pos => {
    const demand = demandByPos[pos] ?? 0;
    const startersProj = startersProjByPos[pos] ?? 0;
    const depthProjWeighted = depthWeightedByPos[pos] ?? 0;
    const replacementBaseline = replacementPerPos[pos] ?? 0;
    const needPoints = demand * replacementBaseline;
    const surplus = startersProj - needPoints;
    const shortage = Math.max(0, needPoints - startersProj);

    // Tier players at this pos
    const posPlayers = (startersByPos[pos] ?? []).concat(benchByPos[pos] ?? []);
    const tiers = tierPlayers(posPlayers, replacementBaseline);

    return { pos, demand, startersProj, depthProjWeighted, replacementBaseline, surplus, shortage, tiers };
  });

  // 6) Identify strongest/weakest positions
  const strongest = byPos.slice().sort((a, b) => (b.surplus + b.depthProjWeighted) - (a.surplus + a.depthProjWeighted))
                    .slice(0, 2).map(x => x.pos);
  const weakest = byPos.slice().sort((a, b) => (b.shortage) - (a.shortage))
                  .slice(0, 2).map(x => x.pos);

  // 7) Trade / add-drop ideas
  const tradeIdeas = strongest.flatMap(give => weakest.map(w => ({
    give, forNeed: w,
    rationale: `Surplus at ${give} (+${fmt(byPos.find(p => p.pos === give)?.surplus)} pts over replacement) vs shortage at ${w} (${fmt(byPos.find(p => p.pos === w)?.shortage)} pts).`
  }))).slice(0, 3);

  const addDropIdeas: { pos: string; addName: string; gain: number; dropName?: string }[] = [];
  Object.keys(benchByPos).forEach(pos => {
    const faTop = faByPos?.[pos]?.[0];
    if (!faTop) return;
    const worstBench = benchByPos[pos].slice().sort((a, b) => (a.proj ?? 0) - (b.proj ?? 0))[0];
    if (!worstBench) return;
    const gain = (faTop.proj ?? 0) - (worstBench.proj ?? 0);
    if (gain > 0.5) addDropIdeas.push({ pos, addName: faTop.name, gain, dropName: worstBench.name });
  });

  return { byPos, strongest, weakest, tradeIdeas, addDropIdeas };
}

// Simple tiering relative to replacement baseline
function tierPlayers(players: { name: string; proj?: number }[], repl: number) {
  return players.slice().sort((a, b) => (b.proj ?? 0) - (a.proj ?? 0)).map(p => {
    const diff = (p.proj ?? 0) - repl;
    const label =
      diff >= 6 ? "Elite" :
        diff >= 3 ? "Starter" :
          diff >= 1.0 ? "Flex-worthy" :
            diff >= 0 ? "Depth" : "Replaceable";
    return { label, name: p.name, proj: p.proj ?? 0 };
  });
}

const fmt = (x?: number) => (x ?? 0).toFixed(1);