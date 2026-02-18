import type { Projection } from "./types";
import { fetchBuiltInCSV } from "./builtin";
import { buildProjectionIndex, normalizePos } from "./projections";
import { fetchJSON } from "./sleeper";

export type ProjectionSource = "statchasers" | "sleeper";
export type FallbackMode = "fallback_to_statchasers" | "zero" | "exclude";

export interface ProjectionProviderOptions {
  season: string;
  week: string | number;
  source: ProjectionSource;
  fallbackMode: FallbackMode;
  playersIndex?: Record<string, any>;
}

export interface ProjectionResult {
  projections: Projection[];
  source: ProjectionSource;
  stats: {
    total: number;
    fromPrimary: number;
    fromFallback: number;
    excluded: number;
  };
  cachedAt?: number;
}

const sleeperCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(season: string, week: string | number): string {
  return `sleeper:${season}:${week}`;
}

export async function fetchSleeperProjections(
  season: string,
  week: string | number
): Promise<any[]> {
  const key = getCacheKey(season, week);
  const cached = sleeperCache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[SleeperProvider] Using cached projections (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
    return cached.data;
  }

  console.log(`[SleeperProvider] Fetching projections for ${season} W${week}`);
  const url = `https://api.sleeper.com/projections/nfl/${season}/${week}?season_type=regular`;
  const data = await fetchJSON<any[]>(url);
  console.log(`[SleeperProvider] Got ${data?.length ?? 0} projection records`);

  sleeperCache[key] = { data: data || [], timestamp: Date.now() };
  return data || [];
}

export function getSleeperCacheTimestamp(season: string, week: string | number): number | null {
  const key = getCacheKey(season, week);
  return sleeperCache[key]?.timestamp ?? null;
}

export function clearSleeperCache(season?: string, week?: string | number): void {
  if (season && week) {
    delete sleeperCache[getCacheKey(season, week)];
  } else {
    for (const key of Object.keys(sleeperCache)) {
      delete sleeperCache[key];
    }
  }
}

function sleeperRowToProjection(
  row: any,
  playersIndex: Record<string, any>
): Projection | null {
  const playerId = row.player_id?.toString();
  if (!playerId) return null;

  const playerInfo = playersIndex[playerId];
  if (!playerInfo) return null;

  const name = [playerInfo.first_name, playerInfo.last_name].filter(Boolean).join(" ")
    || playerInfo.full_name || `Player ${playerId}`;
  const pos = normalizePos(playerInfo.position || playerInfo.fantasy_positions?.[0] || "");
  if (!pos) return null;

  const rowStats = row.stats || {};

  const stats: Record<string, number> = {};
  const statMap: Record<string, string> = {
    pass_att: "pass_att",
    pass_cmp: "pass_comp",
    pass_yd: "pass_yd",
    pass_td: "pass_td",
    pass_int: "pass_int",
    rush_att: "rush_att",
    rush_yd: "rush_yd",
    rush_td: "rush_td",
    rec: "rec",
    rec_yd: "rec_yd",
    rec_td: "rec_td",
    fum_lost: "fum_lost",
    fum: "fum_lost",
    pass_2pt: "two_pt",
    rush_2pt: "two_pt",
    rec_2pt: "two_pt",
    xpm: "xpm",
    xpa: "xpa",
    fgm_0_19: "fgm_0_19",
    fgm_20_29: "fgm_20_29",
    fgm_30_39: "fgm_30_39",
    fgm_40_49: "fgm_40_49",
    fgm_50p: "fgm_50p",
    sack: "sacks",
    def_int: "defs_int",  
    fum_rec: "defs_fum_rec",
    def_td: "defs_td",
    safe: "safety",
    blk_kick: "blk_kick",
    def_st_td: "ret_td",
    pts_allow: "pts_allowed",
  };

  for (const [sleeperKey, ourKey] of Object.entries(statMap)) {
    const val = rowStats[sleeperKey];
    if (val !== undefined && val !== null && Number.isFinite(Number(val))) {
      if (ourKey === "two_pt") {
        stats[ourKey] = (stats[ourKey] || 0) + Number(val);
      } else {
        stats[ourKey] = Number(val);
      }
    }
  }

  const proj = rowStats.pts_ppr ?? rowStats.pts_half_ppr ?? rowStats.pts_std ?? 0;

  const team = (playerInfo.team || "").toUpperCase();
  const opp = row.opponent || "";

  return {
    sleeper_id: playerId,
    name,
    team: team || undefined,
    pos,
    proj: Number(proj) || 0,
    opp: opp || undefined,
    stats,
  };
}

async function fetchStatChasersProjections(
  season: string,
  week: string | number
): Promise<Projection[]> {
  const rows = await fetchBuiltInCSV(season, week);
  return rows as Projection[];
}

export async function getProjections(
  options: ProjectionProviderOptions
): Promise<ProjectionResult> {
  const { season, week, source, fallbackMode, playersIndex } = options;

  if (source === "statchasers") {
    const projections = await fetchStatChasersProjections(season, week);
    return {
      projections,
      source: "statchasers",
      stats: {
        total: projections.length,
        fromPrimary: projections.length,
        fromFallback: 0,
        excluded: 0,
      },
    };
  }

  if (!playersIndex || Object.keys(playersIndex).length === 0) {
    console.warn("[SleeperProvider] No players index available, falling back to StatChasers");
    const projections = await fetchStatChasersProjections(season, week);
    return {
      projections,
      source: "statchasers",
      stats: {
        total: projections.length,
        fromPrimary: projections.length,
        fromFallback: 0,
        excluded: 0,
      },
    };
  }

  const sleeperRaw = await fetchSleeperProjections(season, week);
  const sleeperProjections: Projection[] = [];

  for (const row of sleeperRaw) {
    const proj = sleeperRowToProjection(row, playersIndex);
    if (proj) {
      sleeperProjections.push(proj);
    }
  }

  console.log(`[SleeperProvider] Converted ${sleeperProjections.length} Sleeper projections`);

  if (fallbackMode === "fallback_to_statchasers") {
    let statchasersProjections: Projection[] = [];
    try {
      statchasersProjections = await fetchStatChasersProjections(season, week);
    } catch (e) {
      console.warn("[SleeperProvider] Could not load StatChasers fallback:", e);
    }

    const sleeperIds = new Set(sleeperProjections.map(p => p.sleeper_id).filter(Boolean));
    const fallbackRows: Projection[] = [];

    for (const sc of statchasersProjections) {
      if (sc.sleeper_id && !sleeperIds.has(sc.sleeper_id)) {
        fallbackRows.push(sc);
      }
    }

    const merged = [...sleeperProjections, ...fallbackRows];
    console.log(`[SleeperProvider] Merged: ${sleeperProjections.length} Sleeper + ${fallbackRows.length} StatChasers fallback = ${merged.length} total`);

    return {
      projections: merged,
      source: "sleeper",
      stats: {
        total: merged.length,
        fromPrimary: sleeperProjections.length,
        fromFallback: fallbackRows.length,
        excluded: 0,
      },
      cachedAt: getSleeperCacheTimestamp(season, week) ?? undefined,
    };
  }

  if (fallbackMode === "zero") {
    return {
      projections: sleeperProjections,
      source: "sleeper",
      stats: {
        total: sleeperProjections.length,
        fromPrimary: sleeperProjections.length,
        fromFallback: 0,
        excluded: 0,
      },
      cachedAt: getSleeperCacheTimestamp(season, week) ?? undefined,
    };
  }

  const nonZero = sleeperProjections.filter(p => p.proj > 0);
  return {
    projections: nonZero,
    source: "sleeper",
    stats: {
      total: nonZero.length,
      fromPrimary: nonZero.length,
      fromFallback: 0,
      excluded: sleeperProjections.length - nonZero.length,
    },
    cachedAt: getSleeperCacheTimestamp(season, week) ?? undefined,
  };
}
