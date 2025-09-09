import Papa from "papaparse";
import type { Projection } from "./types";

// Safe number conversion
const num = (v: any) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

export function normalizePos(p?: string) {
  if (!p) return "";
  const up = p.toUpperCase();
  if (["DST","D/ST","DEF","D"].includes(up)) return "DEF";
  return up;
}

export async function parseProjections(file: File): Promise<Projection[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rows: any[] = res.data as any[];
          
          // Fetch Sleeper players database for name lookups
          let playersDb: any = {};
          try {
            const response = await fetch('https://api.sleeper.app/v1/players/nfl');
            playersDb = await response.json();
          } catch (err) {
            console.warn('Could not fetch Sleeper players database:', err);
          }
          
          // Debug: Log first row to see available columns
          if (rows.length > 0) {
            console.log("CSV columns available:", Object.keys(rows[0]));
          }

          const mapped = rows.map((raw) => {
            const sleeperId = (raw.sleeper_id ?? raw.SLEEPER_ID ?? raw.player_id ?? raw.PLAYER_ID)?.toString()?.trim() || undefined;
            let name = (raw.name ?? raw.NAME ?? "").toString().trim();
            
            // If we have a sleeper_id but missing/poor name, try to resolve from Sleeper DB
            if (sleeperId && playersDb[sleeperId] && (!name || name.length < 3)) {
              const player = playersDb[sleeperId];
              name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || `Player ${sleeperId}`;
            }
            
            // Final fallback if still no name
            if (!name && sleeperId) {
              name = `Player ${sleeperId}`;
            }
            
            // Extract detailed stats for league-specific scoring
            const stats: Record<string, number> = {};
            
            // Common stat field mappings (case-insensitive)
            const statMappings = {
              // Passing stats
              'pass_att': ['pass_att', 'PASS_ATT', 'passing_attempts', 'PASSING_ATTEMPTS'],
              'pass_comp': ['pass_comp', 'PASS_COMP', 'pass_cmp', 'PASS_CMP', 'passing_completions', 'PASSING_COMPLETIONS'],
              'pass_yd': ['pass_yd', 'PASS_YD', 'passing_yards', 'PASSING_YARDS'],
              'pass_td': ['pass_td', 'PASS_TD', 'passing_tds', 'PASSING_TDS', 'passing_touchdowns', 'PASSING_TOUCHDOWNS'],
              'pass_int': ['pass_int', 'PASS_INT', 'passing_ints', 'PASSING_INTS', 'passing_interceptions', 'PASSING_INTERCEPTIONS'],
              'pass_2pt': ['pass_2pt', 'PASS_2PT', 'passing_2pt', 'PASSING_2PT'],
              
              // Rushing stats
              'rush_att': ['rush_att', 'RUSH_ATT', 'rushing_attempts', 'RUSHING_ATTEMPTS'],
              'rush_yd': ['rush_yd', 'RUSH_YD', 'rushing_yards', 'RUSHING_YARDS'],
              'rush_td': ['rush_td', 'RUSH_TD', 'rushing_tds', 'RUSHING_TDS', 'rushing_touchdowns', 'RUSHING_TOUCHDOWNS'],
              'rush_2pt': ['rush_2pt', 'RUSH_2PT', 'rushing_2pt', 'RUSHING_2PT'],
              
              // Receiving stats
              'rec': ['rec', 'REC', 'receptions', 'RECEPTIONS', 'receiving_receptions', 'RECEIVING_RECEPTIONS'],
              'rec_yd': ['rec_yd', 'REC_YD', 'receiving_yards', 'RECEIVING_YARDS'],
              'rec_td': ['rec_td', 'REC_TD', 'receiving_tds', 'RECEIVING_TDS', 'receiving_touchdowns', 'RECEIVING_TOUCHDOWNS'],
              'rec_2pt': ['rec_2pt', 'REC_2PT', 'receiving_2pt', 'RECEIVING_2PT'],
              
              // Fumbles
              'fum_lost': ['fum_lost', 'FUM_LOST', 'fumbles_lost', 'FUMBLES_LOST'],
              'fum': ['fum', 'FUM', 'fumbles', 'FUMBLES'],
              
              // Kicking stats
              'xpm': ['xpm', 'XPM', 'extra_points_made', 'EXTRA_POINTS_MADE'],
              'xpmiss': ['xpmiss', 'XPMISS', 'extra_points_missed', 'EXTRA_POINTS_MISSED'],
              'fgm_0_19': ['fgm_0_19', 'FGM_0_19', 'fg_0_19', 'FG_0_19'],
              'fgm_20_29': ['fgm_20_29', 'FGM_20_29', 'fg_20_29', 'FG_20_29'],
              'fgm_30_39': ['fgm_30_39', 'FGM_30_39', 'fg_30_39', 'FG_30_39'],
              'fgm_40_49': ['fgm_40_49', 'FGM_40_49', 'fg_40_49', 'FG_40_49'],
              'fgm_50p': ['fgm_50p', 'FGM_50P', 'fg_50p', 'FG_50P', 'fgm_50_plus', 'FGM_50_PLUS'],
              
              // Defense stats
              'sack': ['sack', 'SACK', 'sacks', 'SACKS', 'def_sack', 'DEF_SACK'],
              'int': ['int', 'INT', 'interceptions', 'INTERCEPTIONS', 'def_int', 'DEF_INT', 'defs_int', 'DEFS_INT'],
              'fum_rec': ['fum_rec', 'FUM_REC', 'def_fum_rec', 'DEF_FUM_REC', 'defs_fum_rec', 'DEFS_FUM_REC'],
              'def_td': ['def_td', 'DEF_TD', 'defs_td', 'DEFS_TD'],
              'safety': ['safety', 'SAFETY', 'def_sfty', 'DEF_SFTY'],
              'blk_kick': ['blk_kick', 'BLK_KICK', 'def_blk_kick', 'DEF_BLK_KICK'],
              'ret_td': ['ret_td', 'RET_TD', 'st_td', 'ST_TD'],
            };

            // Extract stats from CSV columns
            for (const [standardStat, aliases] of Object.entries(statMappings)) {
              for (const alias of aliases) {
                if (raw[alias] !== undefined && raw[alias] !== null && raw[alias] !== '') {
                  const value = num(raw[alias]);
                  if (value !== 0) {
                    stats[standardStat] = value;
                    break; // Found a value, stop looking for other aliases
                  }
                }
              }
            }

            // Debug: Log stats for first player to verify extraction
            if (stats && Object.keys(stats).length > 0) {
              const name = (raw.name ?? raw.NAME ?? "").toString().trim();
              if (name === "Dallas Goedert" || Object.keys(stats).length > 0) {
                console.log(`Stats extracted for ${name}:`, stats);
              }
            }

            return {
              sleeper_id: sleeperId,
              name: name || 'Unknown Player',
              team: (raw.team ?? raw.TEAM ?? "").toString().trim().toUpperCase() || undefined,
              pos: normalizePos((raw.pos ?? raw.POS ?? "").toString().trim()),
              proj: num(raw.proj ?? raw.PROJ),
              opp: (raw.opp ?? raw.OPP ?? "").toString().trim(),
              stats, // Include detailed statistical breakdown
            };
          });

          resolve(mapped as any);
        } catch (e) { reject(e); }
      },
      error: reject,
    });
  });
}

export function buildProjectionIndex(rows: Projection[]) {
  const idx: Record<string, Projection> = {};
  for (const r of rows) {
    if (r.sleeper_id) idx[r.sleeper_id] = r;
    const key = `${r.name.toLowerCase()}|${r.team ?? ""}|${r.pos}`;
    idx[key] = r;
  }
  return idx;
}

export function csvTemplate(): string {
  return [
    ["sleeper_id","name","team","pos","proj","opp","pass_yd","pass_td","rush_yd","rush_td","rec","rec_yd","rec_td"].join(","),
    ["4034","Patrick Mahomes","KC","QB","24.3","","280","2","25","0","0","0","0"].join(","),
    ["6787","Christian McCaffrey","SF","RB","21.9","","0","0","95","1","4","35","0"].join(","),
    ["6792","Justin Jefferson","MIN","WR","20.1","","0","0","0","0","8","110","1"].join(","),
    ["4046","Travis Kelce","KC","TE","17.4","","0","0","0","0","6","75","1"].join(","),
    ["9001","Generic Kicker","FA","K","8.0","","0","0","0","0","0","0","0"].join(","),
    ["4999","San Francisco 49ers","SF","DEF","7.1","","0","0","0","0","0","0","0"].join(","),
  ].join("\n");
}
