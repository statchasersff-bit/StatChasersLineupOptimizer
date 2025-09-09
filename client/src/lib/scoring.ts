type NumRec = Record<string, number | undefined>;

export type LeagueScoring = NumRec; // Sleeper league.settings.scoring_settings

// Safe getter with default
const g = (s: LeagueScoring, k: string, d = 0) => (typeof s?.[k] === "number" ? (s[k] as number) : d);

// Compute offensive player points (QB/RB/WR/TE)
export function scoreOff(stats: NumRec, scoring: LeagueScoring) {
  const passAtt = stats.pass_att ?? 0;
  const passComp = stats.pass_comp ?? 0;
  const passYd = stats.pass_yd ?? 0;
  const passTd = stats.pass_td ?? 0;
  const passInt = stats.pass_int ?? 0;
  const rushAtt = stats.rush_att ?? 0;
  const rushYd = stats.rush_yd ?? 0;
  const rushTd = stats.rush_td ?? 0;
  const rec = stats.rec ?? 0;
  const recYd = stats.rec_yd ?? 0;
  const recTd = stats.rec_td ?? 0;
  const fumLost = stats.fum_lost ?? 0;
  const twoPt = stats.two_pt ?? 0;

  const pts =
    passAtt * g(scoring, "pass_att", 0) +
    passComp * g(scoring, "pass_cmp", 0) +
    passYd * g(scoring, "pass_yd", 0.04) +
    passTd * g(scoring, "pass_td", 4) +
    passInt * g(scoring, "pass_int", -1) +
    rushAtt * g(scoring, "rush_att", 0) +
    rushYd * g(scoring, "rush_yd", 0.1) +
    rushTd * g(scoring, "rush_td", 6) +
    rec * g(scoring, "rec", 1) +
    recYd * g(scoring, "rec_yd", 0.1) +
    recTd * g(scoring, "rec_td", 6) +
    fumLost * g(scoring, "fum_lost", -2) +
    twoPt * g(scoring, "two_pt", 2);

  return pts;
}

// Kickers
export function scoreK(stats: NumRec, scoring: LeagueScoring) {
  const xpm = stats.xpm ?? 0;

  const fgm_0_19 = stats.fgm_0_19 ?? 0;
  const fgm_20_29 = stats.fgm_20_29 ?? 0;
  const fgm_30_39 = stats.fgm_30_39 ?? 0;
  const fgm_40_49 = stats.fgm_40_49 ?? 0;
  const fgm_50p = stats.fgm_50p ?? 0;

  return (
    xpm * g(scoring, "xpm", 1) +
    fgm_0_19 * g(scoring, "fgm_0_19", 3) +
    fgm_20_29 * g(scoring, "fgm_20_29", 3) +
    fgm_30_39 * g(scoring, "fgm_30_39", 3) +
    fgm_40_49 * g(scoring, "fgm_40_49", 4) +
    fgm_50p * g(scoring, "fgm_50p", 5)
  );
}

// DEF/DST (basic bucket)
export function scoreDST(stats: NumRec, scoring: LeagueScoring) {
  const sacks = stats.sacks ?? 0;
  const ints = stats.defs_int ?? 0;
  const fr = stats.defs_fum_rec ?? 0;
  const td = stats.defs_td ?? 0;
  const safety = stats.safety ?? 0;
  const blk = stats.blk_kick ?? 0;
  const ret_td = stats.ret_td ?? 0;

  // Note: points-allowed brackets vary by league; not included here.
  return (
    sacks * g(scoring, "def_sack", 1) +
    ints * g(scoring, "def_int", 2) +
    fr * g(scoring, "def_fum_rec", 2) +
    td * g(scoring, "def_td", 6) +
    safety * g(scoring, "def_sfty", 2) +
    blk * g(scoring, "def_blk_kick", 2) +
    ret_td * g(scoring, "st_td", 6)
  );
}

// Router by position (falls back to provided total)
export function scoreByLeague(pos: string, stats: NumRec, scoring: LeagueScoring, fallbackTotal?: number) {
  const P = pos.toUpperCase();
  if (P === "K") return scoreK(stats, scoring);
  if (P === "DEF" || P === "DST" || P === "D/ST") return scoreDST(stats, scoring);
  
  // Offensive players
  const off = scoreOff(stats, scoring);
  
  // Use calculated score if valid, otherwise fallback
  
  if (!isFinite(off) || off === 0) return fallbackTotal ?? 0;
  return off;
}